import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import yaml from 'js-yaml';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  FilePlus,
  FolderGit2,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Map,
  Plus,
  RefreshCcw,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';

type UserRole = 'Comum' | 'Capitão' | 'Admin' | 'Super Admin';

type StatusCode = 1 | 2 | 3 | 4;

interface HouseRecord {
  status: StatusCode;
  chalkNumber: string;
  officialNumber: string;
  notes: string;
  lastVisit: string | null;
}

interface BlockRecord {
  summary: {
    total: number;
    verde: number;
    amarelo: number;
    laranja: number;
    vermelho: number;
  };
  imageUrl: string;
  houses: Record<string, HouseRecord>;
}

interface TerritoryRecord {
  name: string;
  status: string;
  lastUse: string;
  blocks: Record<string, BlockRecord>;
}

interface AppConfig {
  superAdminEmail: string;
  userRoles: Record<string, UserRole>;
}

interface AppData {
  appConfig: AppConfig;
  territories: Record<string, TerritoryRecord>;
}

const REPO_OWNER = 'EliezerRosa';
const REPO_NAME = 'ControleDeTerrorio';
const FILE_PATH = 'data/db.yml';
const COMMIT_MESSAGE = 'Dados atualizados pelo App de Territórios';
const PAT_STORAGE_KEY = 'territoryAppPat';
const POLL_INTERVAL_MS = 30000;
const WORKFLOW_DISPATCH_KEY = 'territoryAppWorkflowDispatched';

const roleHierarchy: Record<UserRole, number> = {
  Comum: 0,
  'Capitão': 1,
  Admin: 2,
  'Super Admin': 3,
};

const statusCycle: StatusCode[] = [1, 2, 3, 4];
const statusLabels: Record<StatusCode, string> = {
  1: 'Verde • Não visitada',
  2: 'Amarelo • Visita 1 sem contato',
  3: 'Laranja • Visita 2 sem contato',
  4: 'Vermelho • Contato estabelecido',
};
const statusClasses: Record<StatusCode, string> = {
  1: 'bg-emerald-500 hover:bg-emerald-600',
  2: 'bg-amber-400 hover:bg-amber-500',
  3: 'bg-orange-500 hover:bg-orange-600',
  4: 'bg-rose-500 hover:bg-rose-600',
};

const encodeBase64 = (payload: string) => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(payload);
  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
};

const decodeBase64 = (payload: string) => {
  const binary = atob(payload);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
};

const cloneState = <T,>(data: T) => JSON.parse(JSON.stringify(data)) as T;

const hasCapability = (role: UserRole, required: UserRole) =>
  roleHierarchy[role] >= roleHierarchy[required];

const githubContentUrl = () =>
  `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

const recalcBlockSummary = (block: BlockRecord) => {
  const summary = {
    total: 0,
    verde: 0,
    amarelo: 0,
    laranja: 0,
    vermelho: 0,
  };
  Object.values(block.houses).forEach((house) => {
    summary.total += 1;
    if (house.status === 1) summary.verde += 1;
    if (house.status === 2) summary.amarelo += 1;
    if (house.status === 3) summary.laranja += 1;
    if (house.status === 4) summary.vermelho += 1;
  });
  block.summary = summary;
};

const Notification: React.FC<{
  type: 'success' | 'error' | 'info';
  message: string;
}> = ({ type, message }) => {
  const Icon =
    type === 'success' ? CheckCircle2 : type === 'error' ? AlertCircle : RefreshCcw;
  const palette =
    type === 'success'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
      : type === 'error'
        ? 'bg-rose-100 text-rose-700 border-rose-300'
        : 'bg-sky-100 text-sky-700 border-sky-300';

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium shadow-sm ${palette}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
};

const Modal: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}> = ({ title, onClose, children, widthClass = 'max-w-lg' }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className={`w-full rounded-xl bg-white p-6 shadow-2xl ${widthClass}`}>
      <div className="mb-4 flex items-center justify-between border-b pb-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <button
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          onClick={onClose}
        >
          Fechar
        </button>
      </div>
      {children}
    </div>
  </div>
);

const TextInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { label: string }
> = ({ label, className = '', ...rest }) => (
  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
    {label}
    <input
      className={`w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 ${className}`}
      {...rest}
    />
  </label>
);

const Divider: React.FC<{ label?: string }> = ({ label }) => (
  <div className="relative py-4">
    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-200" />
    {label && (
      <span className="relative mx-auto block w-fit bg-white px-3 text-xs uppercase tracking-wide text-slate-400">
        {label}
      </span>
    )}
  </div>
);

interface HouseEditContext {
  territoryId: string;
  blockId: string;
  houseId: string;
}

interface BlockEditContext {
  territoryId: string;
  blockId: string | null;
}

interface TerritoryModalState {
  mode: 'create' | 'edit';
  territoryId: string | null;
}

const AppControleNcs: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [appState, setAppState] = useState<AppData | null>(null);
  const [remoteSha, setRemoteSha] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [activeEmail, setActiveEmail] = useState('');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showPatModal, setShowPatModal] = useState(false);
  const [patValue, setPatValue] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(PAT_STORAGE_KEY) ?? '';
  });
  const [blockEditContext, setBlockEditContext] = useState<BlockEditContext | null>(null);
  const [houseEditContext, setHouseEditContext] = useState<HouseEditContext | null>(null);
  const [territoryModal, setTerritoryModal] = useState<TerritoryModalState | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [chalkLimit, setChalkLimit] = useState('');
  const [userAdminModal, setUserAdminModal] = useState(false);
  const [userRolesDraft, setUserRolesDraft] = useState<[string, UserRole][]>([]);

  const persistPat = useCallback(
    (token: string) => {
      localStorage.setItem(PAT_STORAGE_KEY, token);
      setPatValue(token);
    },
    [],
  );

  const surfaceNotification = useCallback((payload: {
    type: 'success' | 'error' | 'info';
    message: string;
  }) => {
    setNotification(payload);
  }, []);

  const loadRemoteState = useCallback(
    async (reason: 'initial' | 'manual' | 'polling' | 'focus' | 'post-commit' | 'retry') => {
      setIsLoading(true);
      try {
        const headers: HeadersInit = patValue ? { Authorization: `Bearer ${patValue}` } : {};
        const response = await fetch(githubContentUrl(), { headers });
        if (!response.ok) {
          throw new Error(`Falha ao buscar dados (${response.status})`);
        }
        const payload = await response.json();
        const decoded = decodeBase64(payload.content);
        const parsed = yaml.load(decoded) as AppData;
        setAppState(parsed);
        setRemoteSha(payload.sha ?? '');
        surfaceNotification({
          type: 'success',
          message:
            reason === 'initial'
              ? 'Dados carregados do GitHub'
              : reason === 'post-commit'
                ? 'Estado sincronizado após commit'
                : 'Dados sincronizados',
        });
        if (!selectedTerritoryId) {
          const firstTerritory = Object.keys(parsed.territories ?? {})[0] ?? null;
          setSelectedTerritoryId(firstTerritory);
          const firstBlock = firstTerritory
            ? Object.keys(parsed.territories[firstTerritory].blocks ?? {})[0] ?? null
            : null;
          setSelectedBlockId(firstBlock);
          if (firstBlock) {
            setChalkLimit(
              String(
                Object.keys(parsed.territories[firstTerritory].blocks[firstBlock].houses ?? {}).length,
              ),
            );
          }
        }
      } catch (error) {
        console.error(error);
        surfaceNotification({
          type: 'error',
          message: (error as Error).message ?? 'Erro ao buscar dados',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [patValue, selectedTerritoryId, surfaceNotification],
  );

  const ensurePatBeforeCommit = useCallback(() => {
    if (!patValue) {
      surfaceNotification({
        type: 'error',
        message: 'Configure o PAT para enviar alterações ao GitHub',
      });
      setShowPatModal(true);
      return false;
    }
    return true;
  }, [patValue, surfaceNotification]);

  const commitToGitHub = useCallback(
    async (nextState: AppData, actionLabel: string) => {
      if (!ensurePatBeforeCommit()) return;
      setIsSaving(true);
      surfaceNotification({
        type: 'info',
        message: `Salvando alterações (${actionLabel})...`,
      });

      try {
        const yamlString = yaml.dump(nextState, {
          noRefs: true,
          sortKeys: true,
          lineWidth: -1,
        });

        const shaResponse = await fetch(githubContentUrl(), {
          headers: { Authorization: `Bearer ${patValue}` },
        });

        if (!shaResponse.ok) {
          throw new Error(`Erro ao obter SHA (${shaResponse.status})`);
        }

        const shaPayload = await shaResponse.json();

        const commitBody = {
          message: COMMIT_MESSAGE,
          content: encodeBase64(yamlString),
          sha: shaPayload.sha,
        };

        const putResponse = await fetch(githubContentUrl(), {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${patValue}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(commitBody),
        });

        if (!putResponse.ok) {
          throw new Error(`Erro ao confirmar commit (${putResponse.status})`);
        }

        surfaceNotification({ type: 'success', message: 'Commit aplicado com sucesso' });
        await loadRemoteState('post-commit');
      } catch (error) {
        console.error(error);
        surfaceNotification({
          type: 'error',
          message: (error as Error).message ?? 'Falha ao salvar alterações',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [ensurePatBeforeCommit, loadRemoteState, patValue, surfaceNotification],
  );

  const applyStateMutation = useCallback(
    (mutator: (draft: AppData) => void, label: string) => {
      if (!appState) return;
      const draft = cloneState(appState);
      mutator(draft);
      setAppState(draft);
      void commitToGitHub(draft, label);
    },
    [appState, commitToGitHub],
  );

  useEffect(() => {
    void loadRemoteState('initial');
  }, [loadRemoteState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!patValue) return;

    // Garante que o workflow seja disparado apenas uma vez por navegador.
    if (localStorage.getItem(WORKFLOW_DISPATCH_KEY)) return;

    const controller = new AbortController();

    const triggerWorkflow = async () => {
      try {
        // Envia o evento repository_dispatch para acionar o workflow no GitHub Actions.
        const response = await fetch(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${patValue}`,
              'Content-Type': 'application/json',
              Accept: 'application/vnd.github+json',
            },
            body: JSON.stringify({ event_type: 'app-first-access' }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          // Mantém o comportamento silencioso em caso de falha.
          console.warn('Falha ao disparar workflow simulado:', response.statusText);
          return;
        }

        // Memoriza o disparo para evitar execuções futuras neste navegador.
        localStorage.setItem(WORKFLOW_DISPATCH_KEY, 'true');
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('Erro ao disparar workflow simulado:', error);
        }
      }
    };

    void triggerWorkflow();

    return () => controller.abort();
  }, [patValue]);

  useEffect(() => {
    if (!pollingEnabled) return;
    const interval = setInterval(async () => {
      if (!remoteSha) return;
      try {
        const headers: HeadersInit = patValue ? { Authorization: `Bearer ${patValue}` } : {};
        const response = await fetch(githubContentUrl(), { headers });
        if (!response.ok) return;
        const payload = await response.json();
        if (payload.sha && payload.sha !== remoteSha) {
          await loadRemoteState('polling');
        }
      } catch (error) {
        console.warn('Polling falhou', error);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [remoteSha, patValue, loadRemoteState, pollingEnabled]);

  useEffect(() => {
    const handleFocus = () => {
      void loadRemoteState('focus');
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadRemoteState]);

  useEffect(() => {
    if (!notification) return;
    const handle = setTimeout(() => setNotification(null), 4500);
    return () => clearTimeout(handle);
  }, [notification]);

  useEffect(() => {
    if (!userAdminModal || !appState) return;
    const entries = Object.entries(appState.appConfig.userRoles) as [string, UserRole][];
    setUserRolesDraft(entries);
  }, [userAdminModal, appState]);

  const handleLogin = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!appState) return;
      const sanitized = emailInput.trim().toLowerCase();
      if (!sanitized) return;
      const role = appState.appConfig.userRoles[sanitized] ?? 'Comum';
      setActiveEmail(sanitized);
      setUserRole(role);
      surfaceNotification({ type: 'success', message: `Sessão iniciada como ${role}` });
      if (role === 'Super Admin' && !patValue) {
        setShowPatModal(true);
      }
    },
    [appState, emailInput, patValue, surfaceNotification],
  );

  const logout = useCallback(() => {
    setActiveEmail('');
    setUserRole(null);
    surfaceNotification({ type: 'info', message: 'Sessão encerrada' });
  }, [surfaceNotification]);

  const territoryEntries = useMemo(() => {
    if (!appState) return [] as [string, TerritoryRecord][];
    return Object.entries(appState.territories ?? {}).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  }, [appState]);

  const selectedTerritory = useMemo(() => {
    if (!appState || !selectedTerritoryId) return null;
    return appState.territories[selectedTerritoryId] ?? null;
  }, [appState, selectedTerritoryId]);

  const selectedBlock = useMemo(() => {
    if (!selectedTerritory || !selectedBlockId) return null;
    return selectedTerritory.blocks[selectedBlockId] ?? null;
  }, [selectedTerritory, selectedBlockId]);

  useEffect(() => {
    if (!selectedBlock) return;
    setChalkLimit(
      String(Object.keys(selectedBlock.houses ?? {}).length || ''),
    );
  }, [selectedBlock]);

  const cycleHouseStatus = useCallback(
    (houseId: string) => {
      if (!selectedTerritory || !selectedBlock || !selectedTerritoryId || !selectedBlockId) return;
      applyStateMutation((draft) => {
        const block = draft.territories[selectedTerritoryId].blocks[selectedBlockId];
        const house = block.houses[houseId];
        const currentIndex = statusCycle.indexOf(house.status);
        const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
        house.status = nextStatus;
        house.lastVisit = new Date().toISOString();
        recalcBlockSummary(block);
      }, 'Atualização de status da casa');
    },
    [applyStateMutation, selectedBlock, selectedBlockId, selectedTerritory, selectedTerritoryId],
  );

  const updateHouseData = useCallback(
    (houseId: string, updates: Partial<HouseRecord>) => {
      if (!selectedTerritoryId || !selectedBlockId) return;
      applyStateMutation((draft) => {
        const block = draft.territories[selectedTerritoryId].blocks[selectedBlockId];
        block.houses[houseId] = {
          ...block.houses[houseId],
          ...updates,
        };
        recalcBlockSummary(block);
      }, 'Atualização de dados da casa');
    },
    [applyStateMutation, selectedBlockId, selectedTerritoryId],
  );

  const applyChalkSequencing = useCallback(
    (blockId: string, max: number) => {
      if (!selectedTerritoryId || !appState) return;
      applyStateMutation((draft) => {
        const block = draft.territories[selectedTerritoryId].blocks[blockId];
        for (let index = 1; index <= max; index += 1) {
          const key = String(index);
          if (!block.houses[key]) {
            block.houses[key] = {
              status: 1,
              chalkNumber: key,
              officialNumber: '',
              notes: '',
              lastVisit: null,
            };
          }
          block.houses[key].chalkNumber = key;
        }
        Object.keys(block.houses).forEach((key) => {
          const num = Number(key);
          if (Number.isFinite(num) && num > max) {
            delete block.houses[key];
          }
        });
        recalcBlockSummary(block);
      }, 'Sequenciamento da quadra');
    },
    [appState, applyStateMutation, selectedTerritoryId],
  );

  const createOrUpdateTerritory = useCallback(
    (payload: { territoryId: string | null; name: string; status: string; lastUse: string }) => {
      applyStateMutation((draft) => {
        if (!draft.territories) draft.territories = {};
        const nextId =
          payload.territoryId ??
          String(
            Math.max(0, ...Object.keys(draft.territories).map((id) => Number(id))) + 1,
          ).padStart(2, '0');
        if (!draft.territories[nextId]) {
          draft.territories[nextId] = {
            name: payload.name,
            status: payload.status,
            lastUse: payload.lastUse,
            blocks: {},
          };
        } else {
          draft.territories[nextId].name = payload.name;
          draft.territories[nextId].status = payload.status;
          draft.territories[nextId].lastUse = payload.lastUse;
        }
      }, 'CRUD de território');
    },
    [applyStateMutation],
  );

  const deleteTerritory = useCallback(
    (territoryId: string) => {
      applyStateMutation((draft) => {
        delete draft.territories[territoryId];
      }, 'Exclusão de território');
      if (selectedTerritoryId === territoryId) {
        setSelectedTerritoryId(null);
        setSelectedBlockId(null);
      }
    },
    [applyStateMutation, selectedTerritoryId],
  );

  const upsertBlock = useCallback(
    (payload: { territoryId: string; blockId: string | null; imageUrl: string; maxChalk: number }) => {
      applyStateMutation((draft) => {
        const territory = draft.territories[payload.territoryId];
        const blockId =
          payload.blockId ??
          String(
            Math.max(0, ...Object.keys(territory.blocks ?? {}).map((id) => Number(id))) + 1,
          );
        if (!territory.blocks) territory.blocks = {};
        if (!territory.blocks[blockId]) {
          territory.blocks[blockId] = {
            summary: {
              total: payload.maxChalk,
              verde: payload.maxChalk,
              amarelo: 0,
              laranja: 0,
              vermelho: 0,
            },
            imageUrl: payload.imageUrl,
            houses: {},
          };
        }
        territory.blocks[blockId].imageUrl = payload.imageUrl;
        for (let index = 1; index <= payload.maxChalk; index += 1) {
          const key = String(index);
          if (!territory.blocks[blockId].houses[key]) {
            territory.blocks[blockId].houses[key] = {
              status: 1,
              chalkNumber: key,
              officialNumber: '',
              notes: '',
              lastVisit: null,
            };
          }
        }
        recalcBlockSummary(territory.blocks[blockId]);
      }, 'CRUD de quadra');
    },
    [applyStateMutation],
  );

  const deleteBlock = useCallback(
    (territoryId: string, blockId: string) => {
      applyStateMutation((draft) => {
        delete draft.territories[territoryId].blocks[blockId];
      }, 'Exclusão de quadra');
      if (selectedBlockId === blockId) {
        setSelectedBlockId(null);
      }
    },
    [applyStateMutation, selectedBlockId],
  );

  const updateUserRoles = useCallback(
    (roles: Record<string, UserRole>) => {
      applyStateMutation((draft) => {
        draft.appConfig.userRoles = roles;
      }, 'Administração de usuários');
    },
    [applyStateMutation],
  );

  const handlePatSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = patValue.trim();
      if (!value) return;
      persistPat(value);
      setShowPatModal(false);
      surfaceNotification({ type: 'success', message: 'PAT salvo localmente' });
    },
    [patValue, persistPat, surfaceNotification],
  );

  const handleUserModalSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalized = userRolesDraft
        .map(([email, role]) => [email.trim().toLowerCase(), role] as [string, UserRole])
        .filter(([email]) => !!email);
      updateUserRoles(Object.fromEntries(normalized));
      setUserAdminModal(false);
    },
    [updateUserRoles, userRolesDraft],
  );

  useEffect(() => {
    if (territoryModal && territoryModal.territoryId && appState) {
      const territory = appState.territories[territoryModal.territoryId];
      if (!territory) return;
    }
  }, [territoryModal, appState]);

  if (isLoading && !appState) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-10 py-8 shadow-2xl">
          <Loader2 className="h-10 w-10 animate-spin text-slate-700" />
          <p className="text-sm font-medium text-slate-700">Sincronizando com o GitHub...</p>
        </div>
      </main>
    );
  }

  if (!appState) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-8 py-6 text-center shadow-xl backdrop-blur">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-400" />
          <p className="mt-4 text-sm font-medium text-slate-200">
            Não foi possível carregar os dados do GitHub.
          </p>
          <button
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-white"
            onClick={() => void loadRemoteState('retry')}
          >
            <RefreshCcw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }

  if (!userRole) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-3xl border border-slate-800 bg-white/5 p-8 text-slate-100 shadow-2xl backdrop-blur"
        >
          <div className="mb-8 flex items-center gap-3 text-slate-100">
            <Map className="h-8 w-8 text-emerald-400" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Controle de Territórios</h1>
              <p className="text-xs text-slate-300">Informe o e-mail para atribuir o perfil</p>
            </div>
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-100">
            E-mail
            <input
              type="email"
              required
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              placeholder="seu.email@exemplo.com"
              className="w-full rounded-lg border border-slate-300/30 bg-white/10 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 shadow focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </label>
          <button
            type="submit"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-xl shadow-emerald-500/30 transition hover:bg-emerald-400 focus:ring-2 focus:ring-emerald-400/50"
          >
            <LogIn className="h-4 w-4" />
            Entrar
          </button>
          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-slate-200">
            <p className="font-semibold uppercase tracking-wide text-slate-300">Perfis disponíveis</p>
            <ul className="mt-2 space-y-1">
              {Object.entries(appState.appConfig.userRoles).map(([email, role]) => (
                <li key={email} className="flex justify-between text-slate-300">
                  <span>{email}</span>
                  <span className="font-semibold text-emerald-300">{role}</span>
                </li>
              ))}
            </ul>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-1 text-sm font-semibold text-white shadow">
              <FolderGit2 className="h-4 w-4" />
              App Controle NCS
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              {userRole}
            </span>
            <span className="text-xs font-medium text-slate-500">{activeEmail}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadRemoteState('manual')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Sincronizar
            </button>
            {hasCapability(userRole, 'Super Admin') && (
              <button
                onClick={() => setShowPatModal(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100"
              >
                <KeyRound className="h-4 w-4" />
                PAT
              </button>
            )}
            {hasCapability(userRole, 'Super Admin') && (
              <button
                onClick={() => setUserAdminModal(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Users className="h-4 w-4" />
                Usuários
              </button>
            )}
            {hasCapability(userRole, 'Admin') && (
              <button
                onClick={() => setTerritoryModal({ mode: 'create', territoryId: null })}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Território
              </button>
            )}
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {notification && (
        <div className="fixed right-4 top-20 z-50">
          <Notification type={notification.type} message={notification.message} />
        </div>
      )}

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Territórios</h2>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 font-medium">
                <Settings className="h-3.5 w-3.5" />
                Polling a cada 30s
              </span>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={pollingEnabled}
                  onChange={(event) => setPollingEnabled(event.target.checked)}
                />
                Habilitar polling
              </label>
              {isSaving && (
                <span className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Comitando...
                </span>
              )}
            </div>
          </div>
          <div className="scrollbar-thin scrollbar-thumb-slate-300 flex gap-4 overflow-x-auto pb-1">
            {territoryEntries.length === 0 && (
              <div className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
                Nenhum território cadastrado.
              </div>
            )}
            {territoryEntries.map(([territoryId, territory]) => (
              <button
                key={territoryId}
                onClick={() => {
                  setSelectedTerritoryId(territoryId);
                  const firstBlock = Object.keys(territory.blocks ?? {})[0] ?? null;
                  setSelectedBlockId(firstBlock);
                  if (firstBlock) {
                    setChalkLimit(String(Object.keys(territory.blocks[firstBlock].houses ?? {}).length));
                  }
                }}
                className={`min-w-[220px] rounded-2xl border px-4 py-4 text-left shadow-sm transition ${
                  selectedTerritoryId === territoryId
                    ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Território {territoryId}
                </span>
                <h3 className="mt-1 text-base font-semibold">{territory.name}</h3>
                <p
                  className={`mt-2 text-xs font-semibold uppercase tracking-wide ${
                    territory.status === 'Em Uso' ? 'text-emerald-400' : 'text-slate-200'
                  }`}
                >
                  {territory.status}
                </p>
                <p
                  className={`mt-4 text-xs ${
                    selectedTerritoryId === territoryId ? 'text-slate-200' : 'text-slate-500'
                  }`}
                >
                  Último uso: {new Date(territory.lastUse).toLocaleString('pt-BR')}
                </p>
                {hasCapability(userRole, 'Admin') && (
                  <div className="mt-4 flex items-center justify-end gap-2 text-xs">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setTerritoryModal({ mode: 'edit', territoryId });
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 ${
                        selectedTerritoryId === territoryId
                          ? 'border-white/40 text-white/90'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (confirm(`Excluir território ${territoryId}?`)) {
                          deleteTerritory(territoryId);
                        }
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 ${
                        selectedTerritoryId === territoryId
                          ? 'border-white/40 text-white/90'
                          : 'border-rose-200 text-rose-600 hover:bg-rose-50'
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </button>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {selectedTerritory && (
          <div className="grid gap-6 lg:grid-cols-[1.05fr,1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Território {selectedTerritoryId}
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900">{selectedTerritory.name}</h3>
                </div>
                {hasCapability(userRole, 'Admin') && (
                  <button
                    onClick={() =>
                      setBlockEditContext({ territoryId: selectedTerritoryId!, blockId: null })
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-slate-800"
                  >
                    <FilePlus className="h-4 w-4" />
                    Nova Quadra
                  </button>
                )}
              </div>
              <Divider label="Quadras" />
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(selectedTerritory.blocks ?? {}).map(([blockId, block]) => (
                  <div
                    key={blockId}
                    className={`rounded-2xl border p-4 shadow-sm transition ${
                      selectedBlockId === blockId
                        ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Quadra {blockId}
                        </p>
                        <p
                          className={`text-xs ${
                            selectedBlockId === blockId ? 'text-slate-100' : 'text-slate-500'
                          }`}
                        >
                          {Object.keys(block.houses).length} residências
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedBlockId(blockId);
                          setChalkLimit(String(Object.keys(block.houses ?? {}).length));
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          selectedBlockId === blockId
                            ? 'bg-white/10 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        Abrir
                      </button>
                    </div>
                    {hasCapability(userRole, 'Admin') && (
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <button
                          onClick={() =>
                            setBlockEditContext({ territoryId: selectedTerritoryId!, blockId })
                          }
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 ${
                            selectedBlockId === blockId
                              ? 'border-white/40 text-white'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Remover quadra permanentemente?')) {
                              deleteBlock(selectedTerritoryId!, blockId);
                            }
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 ${
                            selectedBlockId === blockId
                              ? 'border-white/40 text-white'
                              : 'border-rose-200 text-rose-600 hover:bg-rose-50'
                          }`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Residências</h3>
                {hasCapability(userRole, 'Capitão') && selectedBlock && (
                  <div className="flex items-center gap-2">
                    <TextInput
                      label="Qtd casas"
                      type="number"
                      min={1}
                      value={chalkLimit}
                      onChange={(event) => setChalkLimit(event.target.value)}
                      className="max-w-[100px]"
                    />
                    <button
                      onClick={() => {
                        const max = Number(chalkLimit);
                        if (Number.isFinite(max) && max > 0) {
                          applyChalkSequencing(selectedBlockId!, max);
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-slate-800"
                    >
                      <Save className="h-4 w-4" />
                      Sequenciar
                    </button>
                  </div>
                )}
              </div>
              {!selectedBlock ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Selecione uma quadra para visualizar as residências.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(selectedBlock.houses ?? {})
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([houseId, house]) => (
                      <div key={houseId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Casa {house.chalkNumber || houseId}
                        </p>
                        <button
                          onClick={() => cycleHouseStatus(houseId)}
                          className={`mt-3 inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-white shadow transition ${statusClasses[house.status]}`}
                        >
                          {statusLabels[house.status]}
                        </button>
                        <div className="mt-3 space-y-2 text-xs text-slate-500">
                          <p>
                            Nº oficial: <span className="font-semibold text-slate-800">{house.officialNumber || '—'}</span>
                          </p>
                          <p>
                            Última visita:{' '}
                            <span className="font-semibold text-slate-700">
                              {house.lastVisit ? new Date(house.lastVisit).toLocaleString('pt-BR') : 'Nunca'}
                            </span>
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setHouseEditContext({
                              territoryId: selectedTerritoryId!,
                              blockId: selectedBlockId!,
                              houseId,
                            })
                          }
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Editar dados
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {showPatModal && (
        <Modal title="Configurar Personal Access Token" onClose={() => setShowPatModal(false)}>
          <form onSubmit={handlePatSubmit} className="space-y-4">
            <p className="text-sm text-slate-600">
              O token será armazenado apenas no navegador e utilizado para autenticar operações na API do GitHub.
            </p>
            <TextInput
              label="Token (PAT)"
              value={patValue}
              onChange={(event) => setPatValue(event.target.value)}
              required
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-400"
            >
              <KeyRound className="h-4 w-4" />
              Salvar Token
            </button>
          </form>
        </Modal>
      )}

      {blockEditContext && (
        <Modal
          title={blockEditContext.blockId ? 'Editar Quadra' : 'Criar Nova Quadra'}
          onClose={() => setBlockEditContext(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.target as HTMLFormElement;
              const formData = new FormData(form);
              const imageUrl = String(formData.get('imageUrl') ?? '');
              const maxChalk = Number(formData.get('maxChalk') ?? 0);
              if (!imageUrl || !Number.isFinite(maxChalk) || maxChalk <= 0) return;
              upsertBlock({
                territoryId: blockEditContext.territoryId,
                blockId: blockEditContext.blockId,
                imageUrl,
                maxChalk,
              });
              setBlockEditContext(null);
            }}
          >
            <TextInput
              label="URL do mapa ou imagem"
              name="imageUrl"
              defaultValue={
                blockEditContext.blockId
                  ? appState.territories[blockEditContext.territoryId].blocks[blockEditContext.blockId].imageUrl
                  : ''
              }
              required
            />
            <TextInput
              label="Quantidade de residências"
              name="maxChalk"
              type="number"
              min={1}
              defaultValue={
                blockEditContext.blockId
                  ? Object.keys(
                      appState.territories[blockEditContext.territoryId].blocks[blockEditContext.blockId].houses,
                    ).length
                  : 10
              }
              required
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
            >
              <Save className="h-4 w-4" />
              Salvar Quadra
            </button>
          </form>
        </Modal>
      )}

      {houseEditContext && (
        <Modal title="Editar Residência" onClose={() => setHouseEditContext(null)}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!houseEditContext) return;
              const form = event.target as HTMLFormElement;
              const formData = new FormData(form);
              const officialNumber = String(formData.get('officialNumber') ?? '');
              const notes = String(formData.get('notes') ?? '');
              updateHouseData(houseEditContext.houseId, {
                officialNumber,
                notes,
              });
              setHouseEditContext(null);
            }}
          >
            <TextInput
              label="Número oficial / fachada"
              name="officialNumber"
              defaultValue={
                appState.territories[houseEditContext.territoryId].blocks[houseEditContext.blockId].houses[
                  houseEditContext.houseId
                ].officialNumber
              }
            />
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Observações
              <textarea
                name="notes"
                defaultValue={
                  appState.territories[houseEditContext.territoryId].blocks[houseEditContext.blockId].houses[
                    houseEditContext.houseId
                  ].notes
                }
                className="min-h-[100px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
            >
              <Save className="h-4 w-4" />
              Salvar Residência
            </button>
          </form>
        </Modal>
      )}

      {userAdminModal && (
        <Modal title="Gerenciar Usuários" onClose={() => setUserAdminModal(false)} widthClass="max-w-3xl">
          <form className="space-y-4" onSubmit={handleUserModalSubmit}>
            <div className="rounded-xl border border-slate-200">
              <div className="grid grid-cols-[2fr,1fr,auto] border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>E-mail</span>
                <span>Perfil</span>
                <span>Ações</span>
              </div>
              <div className="divide-y divide-slate-200">
                {userRolesDraft.map(([email, role], index) => (
                  <div key={`${email}-${index}`} className="grid grid-cols-[2fr,1fr,auto] items-center gap-3 px-4 py-3 text-sm">
                    <input
                      value={email}
                      onChange={(event) => {
                        const next = [...userRolesDraft];
                        next[index] = [event.target.value, role];
                        setUserRolesDraft(next);
                      }}
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                      type="email"
                      required
                    />
                    <select
                      value={role}
                      onChange={(event) => {
                        const next = [...userRolesDraft];
                        next[index] = [email, event.target.value as UserRole];
                        setUserRolesDraft(next);
                      }}
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                    >
                      {(['Comum', 'Capitão', 'Admin', 'Super Admin'] as UserRole[]).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const next = userRolesDraft.filter((_, idx) => idx !== index);
                        setUserRolesDraft(next);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUserRolesDraft((draft) => [...draft, ['', 'Comum']])}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Adicionar linha
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
            >
              <Save className="h-4 w-4" />
              Salvar alterações
            </button>
          </form>
        </Modal>
      )}

      {territoryModal && (
        <Modal
          title={territoryModal.mode === 'create' ? 'Criar Território' : 'Editar Território'}
          onClose={() => setTerritoryModal(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.target as HTMLFormElement;
              const formData = new FormData(form);
              const name = String(formData.get('name') ?? '').trim();
              const status = String(formData.get('status') ?? '').trim();
              const lastUse = String(formData.get('lastUse') ?? '').trim();
              if (!name || !status || !lastUse) return;
              createOrUpdateTerritory({
                territoryId: territoryModal.territoryId,
                name,
                status,
                lastUse,
              });
              setTerritoryModal(null);
            }}
          >
            <TextInput
              label="Nome"
              name="name"
              defaultValue={
                territoryModal.territoryId
                  ? appState.territories[territoryModal.territoryId].name
                  : ''
              }
              required
            />
            <TextInput
              label="Status"
              name="status"
              defaultValue={
                territoryModal.territoryId
                  ? appState.territories[territoryModal.territoryId].status
                  : 'Em Uso'
              }
              required
            />
            <TextInput
              label="Último uso (ISO)"
              name="lastUse"
              defaultValue={
                territoryModal.territoryId
                  ? appState.territories[territoryModal.territoryId].lastUse
                  : new Date().toISOString()
              }
              required
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
            >
              <Save className="h-4 w-4" />
              Salvar Território
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
};

export default AppControleNcs;
