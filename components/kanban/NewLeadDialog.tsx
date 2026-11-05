"use client";

import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateLead } from "@/hooks/kanban/useCreateLead";
import type { RespostaCriacaoDeLead } from "@/hooks/kanban/useCreateLead";
import type { Stage } from "@/lib/kanban/types";
import {
  AVISO_NEGOCIO_ABERTO_EXISTENTE,
  negocioAbertoNoQuadro,
  type NegocioAbertoExistente,
} from "@/lib/leads/negocio-aberto-duplicado";
import type { Lead } from "@/lib/types/leads";
import { createLeadSchema, type CreateLeadInput } from "@/lib/schemas/leads";
import { camposExigidosNoDestino, validaCamposExigidos } from "@/lib/leads/campos-exigidos";
import { lerRecorrenciaDoFormulario } from "@/lib/leads/valor-recorrente";
import { CustomFieldsEditor } from "@/components/contacts/CustomFieldsEditor";
import { camposVisiveis } from "@/lib/schemas/mostrar-quando";
import type { CustomFieldDef, NewLeadFormFieldConfig } from "@/lib/schemas/settings";
import { MOEDA_PADRAO, parseReaisToCents, simboloDaMoeda } from "@/lib/money";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import type { Contact } from "@/lib/types/contacts";
import { AbrirConversaAposSalvar } from "@/components/channels/AbrirConversaAposSalvar";
import type { AlvoDeConversa } from "@/components/channels/SeletorDeCanalParaConversa";
import { EcoDoValor } from "./EcoDoValor";
import { SeletorDeContato } from "./SeletorDeContato";
import { Gear, CaretUp, CaretDown, Eye, EyeSlash } from "@/lib/ui/icons";
import { CAMPOS_PADRAO_DISPONIVEIS, obterListaOrdenadaDeCampos } from "@/app/app/settings/tenant/pipelines/_new-lead-form";
import { updatePipelineConfig } from "@/app/actions/settings/updatePipelineConfig";

interface FormShape {
  title: string;
  description: string;
  stage_id: string;
  valueReais: string;
  /**
   * O VALOR RECORRENTE e a duração (fatia 1 da #3602). Em texto, como o valor
   * único: quem digita "1.500,00" ou "1500" precisa do mesmo parser que respeita
   * a moeda da organização (`parseReaisToCents`).
   */
  valorRecorrenteReais: string;
  recorrenciaMeses: string;
  tagsRaw: string;
  expected_close_date: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelineId: string;
  stages: Stage[];
  /** Vincula o lead criado a este contato de origem (ex.: painel do Inbox). */
  contactId?: string | null;
  /** Depois do INSERT — o inbox relê o resumo para o lead novo aparecer no formulário. */
  onCreated?: () => void;
  /**
   * Negócios do funil, para a pergunta de duplicidade ANTES de criar (#1751).
   *
   * É o quadro que a página de funil já tem em mãos — sem rede, sem atraso no
   * clique. Quem abre pelo Inbox recebe só o `contactId` e não tem esta lista:
   * ali a conferência prévia não acontece, e quem avisa é a `meta.avisos` da
   * resposta (o fallback aqui embaixo). Mesmo funil é filtrado DUAS vezes —
   * aqui e em `negocioAbertoNoQuadro` — porque a duplicidade é mesmo contato +
   * mesmo funil + aberto, e depender de quem chama é como a regra se perde.
   */
  leads?: Lead[];
  /**
   * `crm_pipelines.settings` do funil — dele saem os campos que a ETAPA exige
   * (issue #3038). Quem já tem o funil em mãos passa adiante: o quadro da
   * página do funil (`data.pipeline.settings`) e o `useDefaultPipeline` do
   * painel do Inbox. Sem ele o bloco de campos exigidos não aparece — o funil
   * que não exige nada continua com o formulário byte a byte como era.
   */
  settings?: Record<string, unknown> | null;
}

function defaultStageId(stages: Stage[]): string {
  const open = stages.find((s) => !s.is_won && !s.is_lost && !s.is_archived);
  return open?.id ?? stages[0]?.id ?? "";
}

export function NewLeadDialog({
  open,
  onOpenChange,
  pipelineId,
  stages,
  contactId,
  leads,
  settings,
  onCreated,
}: Props) {
  const t = useT();
  const org = useActiveOrg();
  // Negócio NOVO nasce na moeda da organização (createLeadHandler).
  const moedaDoValor = org?.currency ?? MOEDA_PADRAO;
  const create = useCreateLead(pipelineId);
  /**
   * A CONVERSA A ABRIR DEPOIS DE CRIAR (#3483) — `null` = nada pendente.
   *
   * O trabalho de abrir (canais, claim, Inbox) mora em
   * `AbrirConversaAposSalvar`, montado só quando há alvo: quem abre o diálogo
   * para criar um negócio sem conversa não paga a leitura de canais, e o
   * formulário continua sem depender de router/provider no render.
   */
  const [conversaAoCriar, setConversaAoCriar] = useState<AlvoDeConversa | null>(null);
  const initialStage = useMemo(() => defaultStageId(stages), [stages]);
  // Quem abre o diálogo já sabendo o contato (Inbox) não escolhe de novo.
  const [contato, setContato] = useState<Contact | null>(null);
  /**
   * OS CAMPOS PERSONALIZADOS QUE A ETAPA EXIGE (issue #3038) — o valor que o
   * funil cobra para o negócio ENTRAR na etapa escolhida, digitado AQUI.
   *
   * Antes desta mudança o `createLeadHandler` recusava a criação direta na
   * etapa exigente (a régua da #1710) e o diálogo não tinha onde digitar o
   * campo: a pessoa lia "Preencha os campos obrigatórios antes de continuar:
   * Tipo de cliente" sem nenhum input de "Tipo de cliente" na tela, e o lead
   * não nascia. O valor começa vazio e é limpo junto com o diálogo — o mesmo
   * cuidado do contato, porque o funil mantém este componente montado.
   */
  const [camposDoNegocio, setCamposDoNegocio] = useState<Record<string, unknown>>({});
  // ─── O AVISO DE NEGÓCIO ABERTO DUPLICADO (issue #1751) ─────────────────────
  //
  // Guarda TAMBÉM os valores do formulário: quem chega aqui já preencheu tudo,
  // e confirmar tem de criar sem pedir para digitar de novo. `null` = não há
  // nada pendente. Declarado ANTES do bloco de reset abaixo, que o limpa —
  // use-before-declaration em render é ReferenceError, não linter.
  const [aviso, setAviso] = useState<{
    existente: NegocioAbertoExistente;
    valores: FormShape;
    /** Quem confirmou pediu para abrir a conversa ao criar (#3483). */
    abrir: boolean;
  } | null>(null);

  // O contato é o único campo deste diálogo que cria VÍNCULO, e o componente
  // NÃO desmonta ao fechar: o funil o mantém montado enquanto há dados
  // (`app/app/pipelines/[id]/_client.tsx`). Sem esquecê-lo, quem escolheu um
  // contato, desistiu e fechou reabre com ele ainda selecionado — e o próximo
  // negócio nasce ligado a quem o operador desistiu de usar, sem nada na tela
  // dizendo. A limpeza é feita no RENDER, comparando com o valor anterior, e
  // não em `onOpenChange`: o botão "Cancelar" chama o `onOpenChange` do PAI
  // direto, então um wrapper aqui não cobriria esse caminho. É o padrão que o
  // React documenta para ajustar estado quando uma prop muda — sem efeito, e
  // portanto sem o aviso de `react-hooks/set-state-in-effect`.
  const [estavaAberto, setEstavaAberto] = useState(open);
  if (open !== estavaAberto) {
    setEstavaAberto(open);
    // O aviso morre junto com o diálogo: reabrir para um contato novo não pode
    // reapresentar a pendência de quem desistiu no meio.
    if (!open) {
      setContato(null);
      setAviso(null);
      setCamposDoNegocio({});
    }
  }

  const form = useForm<FormShape>({
    defaultValues: {
      title: "",
      description: "",
      stage_id: initialStage,
      valueReais: "",
      valorRecorrenteReais: "",
      recorrenciaMeses: "",
      tagsRaw: "",
      expected_close_date: "",
    },
  });

  // Reset stage_id default if stages change while dialog mounted.
  useEffect(() => {
    if (!form.getValues("stage_id") && initialStage) {
      form.setValue("stage_id", initialStage);
    }
  }, [initialStage, form]);

  const stageId = form.watch("stage_id");

  /**
   * OS CAMPOS QUE A ETAPA ESCOLHIDA EXIGE — a MESMA pergunta do servidor, feita
   * com a MESMA função (`camposExigidosNoDestino` é o recorte que
   * `validaCamposExigidos` percorre, não uma segunda régua escrita aqui).
   *
   * É recalculada quando a etapa muda no seletor: trocar para uma etapa que não
   * exige nada esvazia o bloco, e trocar para outra exigente o refaz com os
   * campos DELA. `desfecho: null` porque criar não fecha o negócio — os mesmos
   * argumentos do `createLeadHandler` para esta escrita.
   */
  const camposExigidos = useMemo(
    () => camposExigidosNoDestino(settings, { stageId, desfecho: null }),
    [settings, stageId],
  );

  const [customizandoCampos, setCustomizandoCampos] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [localFormConfig, setLocalFormConfig] = useState<NewLeadFormFieldConfig[] | null>(() => {
    return (settings?.new_lead_form as { fields?: NewLeadFormFieldConfig[] } | undefined)?.fields ?? null;
  });

  useEffect(() => {
    if (settings?.new_lead_form) {
      setLocalFormConfig((settings.new_lead_form as { fields?: NewLeadFormFieldConfig[] }).fields ?? null);
    }
  }, [settings]);

  const activeFormConfig = localFormConfig ?? (settings?.new_lead_form as { fields?: NewLeadFormFieldConfig[] } | undefined)?.fields;

  const todosCamposPersonalizados = useMemo(() => {
    const fields = (settings?.fields as CustomFieldDef[] | undefined) ?? [];
    return fields.filter((f) => f.escopo !== "contato");
  }, [settings]);

  // Lista ordenada consolidada de campos para exibição e edição
  const camposOrdenados = useMemo(
    () => obterListaOrdenadaDeCampos(activeFormConfig, todosCamposPersonalizados),
    [activeFormConfig, todosCamposPersonalizados]
  );

  // Filtra campos personalizados que possuem regra condicional (mostrar_quando) sobre a lista inteira
  const chavesVisiveisPorCondicao = useMemo(
    () => new Set(camposVisiveis(todosCamposPersonalizados, camposDoNegocio).map((c) => c.key)),
    [todosCamposPersonalizados, camposDoNegocio]
  );

  const [rascunhoCampos, setRascunhoCampos] = useState<NewLeadFormFieldConfig[]>([]);

  function iniciarCustomizacao() {
    setRascunhoCampos([...camposOrdenados]);
    setCustomizandoCampos(true);
  }

  function alternarRascunho(index: number) {
    setRascunhoCampos((prev) =>
      prev.map((c, i) => (i === index ? { ...c, visible: !c.visible } : c))
    );
  }

  function moverRascunho(index: number, direcao: "cima" | "baixo") {
    setRascunhoCampos((prev) => {
      const target = direcao === "cima" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index]!;
      copy[index] = copy[target]!;
      copy[target] = temp;
      return copy;
    });
  }

  function marcarTodosRascunho(visivel: boolean) {
    setRascunhoCampos((prev) => prev.map((c) => ({ ...c, visible: visivel })));
  }

  async function salvarCustomizacao() {
    setSalvandoConfig(true);
    try {
      const res = await updatePipelineConfig(pipelineId, {
        new_lead_form: { fields: rascunhoCampos },
      });

      if (!res.ok) {
        toast.error(t("Erro ao salvar configuração dos campos"));
        return;
      }

      setLocalFormConfig(rascunhoCampos);
      setCustomizandoCampos(false);
      toast.success(t("Campos e ordem do formulário salvos com sucesso!"));
    } finally {
      setSalvandoConfig(false);
    }
  }

  /**
   * O QUE AINDA FALTA para esta criação — para o formulário não chamar a API
   * que já sabe que vai ser recusada (era a ida e volta que deixava o botão em
   * "Criando…") e para dizer o que falta AO LADO do campo, em vez de só num
   * toast sobre um campo que a tela não mostrava.
   */
  const faltandoNaEtapa = useMemo(
    () =>
      validaCamposExigidos({
        lead: { custom_fields: camposDoNegocio },
        settingsDoFunil: settings,
        destino: { stageId, desfecho: null },
        motivoDeGanho: null,
        // O arquivo ainda não pode existir (#3433): o anexo é do negócio, e o
        // negócio é o que este formulário vai criar. Sem isto, a etapa que pede
        // documento deixava o botão "Criar negócio" travado para sempre — o campo
        // aparecia como faltando e não havia onde anexar.
        semAnexosAinda: true,
      }).faltando,
    [settings, stageId, camposDoNegocio],
  );

  /**
   * O submit normal. ANTES de qualquer chamada de rede vem a pergunta de
   * duplicidade (#1751) — se já houver um negócio aberto deste contato NESTE
   * funil, o diálogo para aqui com o link na mão e nada é criado. Quem decide
   * se o segundo nasce é a pessoa, não o banco: a 0256 proíbe o bloqueio.
   */
  async function onSubmit(values: FormShape) {
    await perguntarAntesDeGravar(values, false);
  }

  /**
   * O "Salvar e iniciar conversa" (#3483): a MESMA criação, e depois a conversa
   * do contato do negócio aberta no Inbox.
   *
   * ─── Por que ele passa pela mesma pergunta de duplicidade ────────────────
   *
   * Porque o caminho é o de criar, não um segundo caminho: um negócio aberto
   * duplicado continua sendo a pergunta da #1751, e a intenção de abrir a
   * conversa viaja junto com os valores para o "Criar mesmo assim" (nem a
   * resposta se perde, nem a conversa deixa de abrir depois da confirmação).
   *
   * ─── Negócio sem pessoa não tem conversa ────────────────────────────────
   *
   * Abrir a thread 1:1 precisa de contato, e o funil aceita lead sem nenhum
   * (automação e importação criam assim de propósito). Nesse caso o botão fica
   * desabilitado com o motivo visível, em vez de virar um clique que não faz
   * nada — a mesma régua do card, que diz POR QUE não dá para abrir.
   */
  async function onSubmitIniciandoConversa(values: FormShape) {
    await perguntarAntesDeGravar(values, true);
  }

  /** A pergunta de duplicidade (#1751), com a intenção de abrir a conversa. */
  async function perguntarAntesDeGravar(values: FormShape, abrir: boolean) {
    const idDoContato = contactId ?? contato?.id ?? null;
    const existente = negocioAbertoNoQuadro(leads ?? [], {
      pipelineId,
      contactId: idDoContato,
    });
    if (existente) {
      setAviso({ existente, valores: values, abrir });
      return;
    }
    await gravar(values, false, abrir);
  }

  /** Quem confirmou o aviso: cria sem perguntar de novo (a pergunta já foi). */
  async function confirmarAviso() {
    if (!aviso) return;
    const { valores, abrir } = aviso;
    setAviso(null);
    await gravar(valores, true, abrir);
  }

  /**
   * A criação de fato. `avisoJaMostrado` é quem sabe se a pessoa JÁ viu a
   * duplicidade — é a única forma de não dizer a mesma coisa duas vezes.
   */
  async function gravar(values: FormShape, avisoJaMostrado: boolean, abrir: boolean) {
    // A régua da ETAPA (#1710) agora está visível no próprio formulário: se
    // ainda falta campo, a recusa sai daqui — sem ida e volta, e com a pessoa
    // no diálogo, o input na frente dela. O servidor segue perguntando a MESMA
    // coisa (defesa em profundidade, e é ele quem decide); o que muda é que o
    // caminho do operador não depende mais de um 422 para explicar o que a tela
    // não mostrava.
    if (faltandoNaEtapa.length > 0) return;

    const tags = values.tagsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const reais = values.valueReais.trim();
    let valueCents: number | null = null;
    if (reais.length > 0) {
      // Negócio NOVO nasce na moeda da organização (é ela que o servidor grava
      // e é ela que o rótulo do campo mostra) — e é ela que diz se a vírgula é
      // decimal ou separador de milhar (#3331).
      valueCents = parseReaisToCents(reais, moedaDoValor);
      if (valueCents === null) {
        form.setError("valueReais", { message: t("Valor inválido") });
        return;
      }
    }

    // A MENSALIDADE (fatia 1 da #3602). Ela NÃO entra no `value_cents`: o valor
    // único continua sendo o setup, e a soma dos dois é o número que ninguém
    // consegue separar depois. A leitura dos dois campos é a régua COMPARTILHADA
    // com os outros dois formulários (`lerRecorrenciaDoFormulario`): a moeda da
    // organização decide a vírgula, e duração sem mensalidade é recusa.
    const leitura = lerRecorrenciaDoFormulario(
      values.valorRecorrenteReais,
      values.recorrenciaMeses,
      moedaDoValor,
    );
    if (!leitura.ok) {
      form.setError(leitura.campo === "valor" ? "valorRecorrenteReais" : "recorrenciaMeses", {
        message:
          leitura.motivo === "valor_invalido"
            ? t("Valor inválido")
            : leitura.motivo === "duracao_invalida"
              ? t("Duração inválida")
              : t("Informe a mensalidade para usar a duração"),
      });
      return;
    }

    let leadTitle = values.title?.trim() || "";
    if (!leadTitle) {
      if (contato) {
        leadTitle = rotuloDoContato(contato, t);
      }
      if (!leadTitle || leadTitle.length < 2) {
        const dataAtual = new Date().toLocaleDateString("pt-BR");
        leadTitle = `Lead ${dataAtual}`;
      }
    }

    const payload: Record<string, unknown> = {
      pipeline_id: pipelineId,
      stage_id: values.stage_id || initialStage,
      title: leadTitle,
      // A moeda NÃO vai daqui. O browser não sabe a moeda da organização, e
      // mandar "BRL" fazia toda instalação em peso ou dólar cadastrar lead em
      // real. Omitir é o conserto: quem decide é o servidor, que lê a
      // organização (`moedaDaOrganizacao`, em `createLeadHandler`).
      source: "manual",
      tags,
    };
    const idDoContato = contactId ?? contato?.id ?? null;
    if (idDoContato) payload.contact_id = idDoContato;
    if (values.description.trim()) payload.description = values.description.trim();
    if (valueCents !== null) payload.value_cents = valueCents;
    if (leitura.trio.recurring_value_cents !== null) {
      payload.recurring_value_cents = leitura.trio.recurring_value_cents;
      payload.recurring_period = leitura.trio.recurring_period;
      if (leitura.trio.recurring_months !== null) {
        payload.recurring_months = leitura.trio.recurring_months;
      }
    }
    if (values.expected_close_date) payload.expected_close_date = values.expected_close_date;
    // Os campos que a etapa exige viajam NESTA criação (issue #3038): o
    // `createLeadSchema` os aceita e o `createLeadHandler` valida/grava o
    // mesmo objeto que a régua da etapa acabou de ler.
    if (Object.keys(camposDoNegocio).length > 0) payload.custom_fields = camposDoNegocio;

    const parsed = createLeadSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? t("Dados inválidos"));
      return;
    }

    try {
      const resposta = await create.mutateAsync(parsed.data as CreateLeadInput);
      // ─── O AVISO QUE CHEGA JUNTO COM A RESPOSTA (#1751) ────────────────────
      //
      // É o caminho em que NÃO dá para perguntar antes: o diálogo aberto pelo
      // Inbox recebe só o `contactId`, sem a lista de negócios do funil. A API
      // avisa sem recusar (a 0256 proíbe o bloqueio), e a tela traduz esse
      // `meta.avisos` no mesmo link do aviso prévio — nunca em silêncio.
      //
      // `avisoJaMostrado` evita a segunda chamada de quem já confirmou o aviso
      // no diálogo: a mesma duplicidade contada duas vezes ensina a ignorar.
      const meta = (resposta as RespostaCriacaoDeLead | null | undefined)?.meta;
      const avisos = meta?.avisos ?? [];
      if (!avisoJaMostrado && avisos.includes(AVISO_NEGOCIO_ABERTO_EXISTENTE)) {
        const existente = meta?.negocio_aberto_existente;
        toast.warning(t("Este contato já tem um negócio aberto neste funil."), {
          description: existente ? (
            <a
              href={`/app/pipelines/${pipelineId}?lead=${existente.id}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {existente.title}
            </a>
          ) : undefined,
        });
      }
      toast.success(t("Negócio criado"));
      onCreated?.();
      form.reset({
        title: "",
        description: "",
        stage_id: initialStage,
        valueReais: "",
        valorRecorrenteReais: "",
        recorrenciaMeses: "",
        tagsRaw: "",
        expected_close_date: "",
      });
      setContato(null);
      setAviso(null);
      setCamposDoNegocio({});
      onOpenChange(false);
    } catch {
      // toast already shown — e nada foi criado, então não há conversa a abrir.
      return;
    }

    // ─── ABRIR A CONVERSA DO NEGÓCIO RECÉM-CRIADO (#3483) ──────────────────
    // Fora do `try` de propósito: o negócio JÁ existe, e uma falha ao abrir
    // (sem sessão de canal, papel insuficiente) não pode ser contada como falha
    // de criação — o toast de erro do `create` seria uma segunda mentira sobre
    // a mesma escrita. `idDoContato` foi lido ANTES do reset que soltou o
    // contato escolhido, senão o id sumiria junto com o estado.
    if (!abrir || !idDoContato) return;
    setConversaAoCriar({ contact_id: idDoContato });
  }

  // Negócio sem pessoa não tem para quem o WhatsApp falar nem com quem a
  // automação casar. Dizer isso na hora vale mais que travar: quem abre o card
  // no meio da ligação e completa depois continua conseguindo, e a importação e
  // as automações seguem criando sem contato de propósito.
  const faltaContato = !contactId && !contato;

  /**
   * Dá para abrir a conversa ao salvar? Precisa de um CONTATO — a thread 1:1 é
   * com uma pessoa — e, quando o contato foi escolhido AQUI (onde o telefone é
   * conhecido), de telefone: é a mesma régua do card do funil. Contato vindo
   * por `contactId` (o painel do Inbox) é o de uma conversa que já existe, e ali
   * o telefone não se pergunta de novo.
   *
   * O motivo fica VISÍVEL no botão: um clique que não faz nada ensina que o
   * sistema quebrou.
   */
  const semTelefoneNoContato = Boolean(contato) && !contato?.phone_number?.trim();
  const podeIniciarConversa = !faltaContato && !semTelefoneNoContato;
  const motivoSemConversa = faltaContato
    ? t("Escolha um contato para abrir a conversa.")
    : semTelefoneNoContato
      ? t("Sem telefone no contato: cadastre um telefone para abrir a conversa.")
      : null;

  function escolherContato(escolhido: Contact | null) {
    setContato(escolhido);
    if (escolhido && !form.getValues("title").trim()) {
      form.setValue("title", rotuloDoContato(escolhido, t));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={customizandoCampos ? "w-full sm:max-w-xl md:max-w-2xl max-h-[85vh] overflow-y-auto p-5 sm:p-6" : "w-full sm:max-w-lg md:max-w-xl lg:max-w-[650px] max-h-[88vh] overflow-y-auto p-5 sm:p-6"}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{customizandoCampos ? t("Personalizar campos deste formulário") : t("Novo lead")}</DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 cursor-pointer"
              onClick={customizandoCampos ? () => setCustomizandoCampos(false) : iniciarCustomizacao}
            >
              <Gear size={13} />
              <span>{customizandoCampos ? t("Voltar ao formulário") : t("Personalizar campos")}</span>
            </Button>
          </div>
          <DialogDescription>
            {customizandoCampos
              ? t("Selecione quais campos devem aparecer ao cadastrar um novo lead neste funil.")
              : t("Abra um novo lead para um contato neste funil.")}
          </DialogDescription>
        </DialogHeader>

        {customizandoCampos ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("Use as setas para alterar a ordem e selecione para exibir ou ocultar:")}</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => marcarTodosRascunho(true)}
                >
                  {t("Marcar todos")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => marcarTodosRascunho(false)}
                >
                  {t("Desmarcar todos")}
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
              {rascunhoCampos.map((campo, idx) => {
                const ativo = campo.visible;
                const padrao = CAMPOS_PADRAO_DISPONIVEIS.find((p) => p.key === campo.key);
                const cp = !campo.is_standard
                  ? todosCamposPersonalizados.find((c) => c.key === campo.key)
                  : null;

                return (
                  <div
                    key={campo.key}
                    className={`flex items-center justify-between gap-3 rounded-md border p-2.5 transition-colors ${
                      ativo
                        ? "border-accent/40 bg-accent/5"
                        : "border-border bg-background opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Botões de reordenação */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moverRascunho(idx, "cima")}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                          title={t("Mover para cima")}
                        >
                          <CaretUp size={14} weight="bold" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === rascunhoCampos.length - 1}
                          onClick={() => moverRascunho(idx, "baixo")}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                          title={t("Mover para baixo")}
                        >
                          <CaretDown size={14} weight="bold" />
                        </button>
                      </div>

                      <span className="text-xs font-mono font-medium text-muted-foreground w-6 text-center shrink-0">
                        #{idx + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {campo.label}
                          </span>
                          {campo.is_standard ? (
                            <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {t("Padrão")}
                            </span>
                          ) : (
                            <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                              {cp?.type ?? t("Personalizado")}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {padrao?.dica ?? `chave: ${campo.key}`}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => alternarRascunho(idx)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                        ativo
                          ? "bg-accent text-accent-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {ativo ? <Eye size={13} /> : <EyeSlash size={13} />}
                      <span>{ativo ? t("Visível") : t("Oculto")}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="pt-3 border-t border-border flex justify-between sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setCustomizandoCampos(false)}>
                {t("Cancelar")}
              </Button>
              <Button type="button" onClick={() => void salvarCustomizacao()} disabled={salvandoConfig}>
                {salvandoConfig ? t("Salvando…") : t("Salvar e aplicar campos")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3.5 gap-y-3 items-start">
            {camposOrdenados.map((campoConfig) => {
              const isCustom = !campoConfig.is_standard;
              const campoDef = isCustom
                ? todosCamposPersonalizados.find((c) => c.key === campoConfig.key)
                : null;
              const isExigidoPelaEtapa = isCustom && camposExigidos.some((e) => e.key === campoConfig.key);

              if (!campoConfig.visible && !isExigidoPelaEtapa) {
                return null;
              }

              switch (campoConfig.key) {
                case "contact":
                  if (contactId) return null;
                  return (
                    <div key="contact" className="col-span-1 md:col-span-2 space-y-2">
                      <SeletorDeContato escolhido={contato} onEscolher={escolherContato} />
                      {faltaContato && (
                        <p className="text-xs text-muted-foreground">
                          {t("Sem contato, este lead não recebe WhatsApp nem entra nas automações.")}
                        </p>
                      )}
                    </div>
                  );

                case "title":
                  return (
                    <div key="title" className="col-span-1 md:col-span-2 space-y-2">
                      <Label htmlFor="title">{t("Título")}</Label>
                      <Input
                        id="title"
                        placeholder={t("Ex: Pedido Maria — combo presente")}
                        {...form.register("title", {
                          required: campoConfig.visible,
                          minLength: campoConfig.visible ? 2 : 0,
                        })}
                      />
                    </div>
                  );

                case "stage_id":
                  return (
                    <div key="stage_id" className="col-span-1 space-y-2">
                      <Label>{t("Etapa")}</Label>
                      <Select
                        value={stageId}
                        onValueChange={(v) => form.setValue("stage_id", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("Selecione a etapa")} />
                        </SelectTrigger>
                        <SelectContent>
                          {stages
                            .filter((s) => !s.is_archived)
                            .map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );

                case "description":
                  return (
                    <div key="description" className="col-span-1 md:col-span-2 space-y-2">
                      <Label htmlFor="description">{t("Descrição")}</Label>
                      <Textarea
                        id="description"
                        rows={2}
                        placeholder={t("Contexto, observações, links…")}
                        {...form.register("description")}
                      />
                    </div>
                  );

                case "value":
                  return (
                    <div key="value" className="col-span-1 space-y-2">
                      <Label htmlFor="valueReais">
                        {t("Valor")} ({simboloDaMoeda(moedaDoValor)})
                      </Label>
                      <Input
                        id="valueReais"
                        inputMode="decimal"
                        placeholder="0,00"
                        {...form.register("valueReais")}
                      />
                      <EcoDoValor control={form.control} moeda={moedaDoValor} />
                      {form.formState.errors.valueReais && (
                        <p className="text-xs text-error-fg">
                          {form.formState.errors.valueReais.message}
                        </p>
                      )}
                    </div>
                  );

                case "expected_close_date":
                  return (
                    <div key="expected_close_date" className="col-span-1 space-y-2">
                      <Label htmlFor="expected_close_date">{t("Fechamento previsto")}</Label>
                      <Input
                        id="expected_close_date"
                        type="date"
                        {...form.register("expected_close_date")}
                      />
                    </div>
                  );

                case "recorrencia":
                  return (
                    <div key="recorrencia" className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="valorRecorrenteReais">
                          {t("Valor recorrente (mensal)")} ({simboloDaMoeda(moedaDoValor)})
                        </Label>
                        <Input
                          id="valorRecorrenteReais"
                          inputMode="decimal"
                          placeholder="0,00"
                          {...form.register("valorRecorrenteReais")}
                        />
                        <EcoDoValor
                          control={form.control}
                          moeda={moedaDoValor}
                          campo="valorRecorrenteReais"
                        />
                        {form.formState.errors.valorRecorrenteReais && (
                          <p className="text-xs text-error-fg">
                            {form.formState.errors.valorRecorrenteReais.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="recorrenciaMeses">{t("Duração (meses)")}</Label>
                        <Input
                          id="recorrenciaMeses"
                          inputMode="numeric"
                          placeholder={t("sem prazo")}
                          {...form.register("recorrenciaMeses")}
                        />
                        {form.formState.errors.recorrenciaMeses && (
                          <p className="text-xs text-error-fg">
                            {form.formState.errors.recorrenciaMeses.message}
                          </p>
                        )}
                      </div>
                    </div>
                  );

                case "tags":
                  return (
                    <div key="tags" className="col-span-1 md:col-span-2 space-y-2">
                      <Label htmlFor="tagsRaw">{t("Tags (separadas por vírgula)")}</Label>
                      <Input
                        id="tagsRaw"
                        placeholder="vip, recompra"
                        {...form.register("tagsRaw")}
                      />
                    </div>
                  );

                default:
                  if (campoDef) {
                    if (!chavesVisiveisPorCondicao.has(campoDef.key)) {
                      return null;
                    }
                    const isFullWidth =
                      campoDef.type === "textarea" ||
                      campoDef.type === "file" ||
                      campoDef.type === "multiselect" ||
                      campoDef.type === "boolean" ||
                      Boolean(campoDef.multiple);
                    return (
                      <div
                        key={campoConfig.key}
                        className={isFullWidth ? "col-span-1 md:col-span-2" : "col-span-1"}
                      >
                        <CustomFieldsEditor
                          fields={[campoDef]}
                          value={camposDoNegocio}
                          onChange={setCamposDoNegocio}
                          mode="lead"
                          className="block"
                        />
                      </div>
                    );
                  }
                  return null;
              }
            })}
          </div>

          {faltandoNaEtapa.length > 0 && (
            <p role="alert" className="text-xs text-error-fg">
              {t("Preencha os campos obrigatórios antes de continuar: {campos}.").replace(
                "{campos}",
                faltandoNaEtapa.map((campo) => campo.rotulo).join(", "),
              )}
            </p>
          )}

          {/* O AVISO SEM BLOQUEIO (#1751): aparece quando já existe negócio
              aberto deste contato NESTE funil. Ele não recusa nada — só para o
              clique e pergunta, com o link para quem já está no quadro. Recusar
              ("Não criar") fecha a pendência sem TOCAR na rede: nada é criado. */}
          {aviso && (
            <div
              role="alert"
              className="rounded-md border border-amber-300 bg-amber-100 p-3 text-sm text-amber-950"
            >
              <p className="font-medium">
                {t("Este contato já tem um lead aberto neste funil.")}
              </p>
              <p className="mt-1">{t("Abrir mesmo assim?")}</p>
              {/* O link é o próprio título do negócio — dado do banco, não
                  texto de interface: traduzir seria mentir sobre o que a pessoa
                  vai abrir. */}
              <a
                href={`/app/pipelines/${pipelineId}?lead=${aviso.existente.id}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block underline"
              >
                {aviso.existente.title}
              </a>
              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setAviso(null)}>
                  {t("Não criar")}
                </Button>
                <Button type="button" onClick={() => void confirmarAviso()}>
                  {t("Criar mesmo assim")}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              {t("Cancelar")}
            </Button>
            {/* O CAMINHO DA #3483: criar o negócio e já cair na conversa do
                contato dele. `handleSubmit` no clique porque a intenção viaja
                no argumento — o mesmo formulário, dois desfechos, e nenhum
                estado que possa sobrar para o próximo negócio. */}
            <Button
              type="button"
              variant="secondary"
              disabled={create.isPending || !stageId || !podeIniciarConversa}
              title={motivoSemConversa ?? undefined}
              onClick={form.handleSubmit((values) => void onSubmitIniciandoConversa(values))}
            >
              {t("Salvar e iniciar conversa")}
            </Button>
            <Button type="submit" disabled={create.isPending || !stageId}>
              {create.isPending ? t("Criando…") : t("Criar lead")}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
      {/* FORA do `DialogContent`: o formulário FECHA ao criar e a abertura da
          conversa (com a escolha de canal, #2382) vem depois — aqui ela
          sobrevive ao fechamento do cadastro. */}
      {conversaAoCriar && <AbrirConversaAposSalvar alvo={conversaAoCriar} />}
    </Dialog>
  );
}
