import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Response } from 'express';

export const ALLOWED_COLLECTIONS = new Set([
  'users',
  'admins',
  'files',
  'folders',
  'events',
  'shares',
  'activities',
  'settings',
  'church_settings',
  'church_announcements',
  'church_events',
  'church_articles',
  'church_albums',
  'church_downloads',
  'team_tasks',
  'team_notes',
  'financial_records',
  'financial_bills',
  'public_events',
  'event_registrations',
  'attendance_departments',
  'attendance_members',
  'attendance_calls',
]);

export interface StoredUserRecord {
  uid: string;
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'media_admin' | 'media_member';
  roleLabel: string;
  avatar: string;
  status: 'active' | 'blocked';
  canManageChurchPage?: boolean;
  canManageFinances?: boolean;
  passwordHash?: string;
  createdAt: string;
  updatedAt?: string;
}

export type DbCollections = Record<string, Record<string, any>>;

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function sanitizeUser(u: any) {
  if (!u) return u;
  const { passwordHash: _removed, ...safe } = u;
  return safe;
}

function buildDefaultChurchProfile() {
  return {
    id: 'profile',
    name: 'IEADAM Petrópolis B',
    slogan: 'Uma igreja acolhedora, firmada na Palavra e viva no amor de Cristo.',
    highlightVerse: {
      text: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.',
      reference: 'João 3:16',
    },
    welcomeMessage:
      'Seja muito bem-vindo à nossa comunidade de fé! Estamos de braços abertos para caminhar com você e sua família no discipulado e na comunhão com Cristo Jesus.',
    history:
      'A Igreja Evangélica Assembleia de Deus no Amazonas - Petrópolis B (IEADAM Petrópolis B) nasceu do anseio fervoroso de proclamar o Evangelho fiel às Escrituras Sagradas. Ao longo de sua trajetória, tem servido com cultos inspiradores, discipulado bíblico, assistência às famílias e ministérios atuantes em todas as faixas etárias.',
    mission:
      'Glorificar a Deus através da pregação integral do Evangelho, da adoração bíblica, do discipulado e do serviço amoroso à comunidade.',
    vision:
      'Ser uma igreja espiritualmente viva, acolhedora, multiplicadora de líderes e referência de integridade e amor prático no bairro e no mundo.',
    values: [
      'Fidelidade incondicional à Bíblia Sagrada',
      'Comunhão fraternal sincera e acolhimento',
      'Oração constante e dependência do Espírito Santo',
      'Adoração com reverência e alegria',
      'Missões e compromisso evangelístico',
      'Cuidado com a família e a próxima geração',
    ],
    leadership: [
      {
        id: 'lead-1',
        name: 'Pr. Pedro Martins',
        role: 'Pastor Titular & Ministério Pastoral',
        bio: 'Dedicado ao ensino expositivo das Escrituras, ao aconselhamento bíblico e à visão da igreja.',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      },
    ],
    serviceTimes: [
      {
        id: 'st-1',
        day: 'Domingo',
        time: '09h00',
        title: 'Escola Bíblica Dominical (EBD)',
        description: 'Classes de estudo bíblico aprofundado para crianças, jovens, adultos e novos convertidos.',
      },
      {
        id: 'st-2',
        day: 'Domingo',
        time: '18h30',
        title: 'Culto de Celebração & Louvor',
        description: 'Nosso culto principal com louvor congregacional, proclamação da Palavra e celebração.',
      },
      {
        id: 'st-3',
        day: 'Quarta-feira',
        time: '19h30',
        title: 'Culto de Oração & Doutrina',
        description: 'Momento de intercessão comunitária e estudo temático das Escrituras.',
      },
      {
        id: 'st-4',
        day: 'Sábado',
        time: '19h30',
        title: 'Culto de Jovens (Conexão)',
        description: 'Reunião vibrante de juventude com louvor contemporâneo, comunhão e dinâmicas bíblicas.',
      },
    ],
    heroBannerUrl:
      'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1800&q=80',
    contact: {
      phone: '(82) 3321-4500',
      whatsapp: '(82) 99876-5432',
      email: 'contato@pibt.org.br',
      address: 'Av. Doutor Jorge Montenegro Barros, Tabuleiro do Martins',
      cityState: 'Maceió - AL, CEP 57081-000',
      mapsEmbedUrl:
        'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3933.8821946252926!2d-35.76569112417772!3d-9.589839990494498!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x7014603953d5a57%3A0x6a0907a934440035!2sTabuleiro%20do%20Martins%2C%20Macei%C3%B3%20-%20AL!5e0!3m2!1spt-BR!2sbr!4v1715000000000!5m2!1spt-BR!2sbr',
      mapsLink: 'https://maps.google.com/?q=Tabuleiro+do+Martins+Maceio',
    },
    social: {
      instagram: 'https://instagram.com/pibt_oficial',
      youtube: 'https://youtube.com/@pibt_oficial',
      facebook: 'https://facebook.com/pibt.oficial',
      spotify: 'https://spotify.com',
    },
    updatedAt: new Date().toISOString(),
  };
}

function buildInitialRoster(now: string) {
  const groups = [
    {
      id: 'dept_pastores',
      name: 'Pastores',
      kind: 'ministerio',
      order: 1,
      roleTitle: 'Corpo Pastoral',
      members: ['Pr. Sobreiro', 'Pra. Fatima'],
    },
    {
      id: 'dept_diaconos',
      name: 'Diáconos',
      kind: 'ministerio',
      order: 2,
      roleTitle: 'Corpo Diaconal',
      members: [
        'Dc. Benedito',
        'Dca. Katia',
        'Dc. Charles',
        'Dca. Ivone',
        'Dca. Líder Sebastiana',
        'Dca. Líder Kélia',
        'Dca. Líder Cícera',
        'Dc. Líder Erick',
        'Dca. Líder Ingrid',
      ],
    },
    {
      id: 'dept_lideres',
      name: 'Líderes',
      kind: 'equipe',
      order: 3,
      roleTitle: 'Liderança',
      members: [
        'Líder Dulce',
        'Líder Lene',
        'Líder Jane',
        'Líder Francirema',
        'Líder Keylah',
        'Líder Felipe',
        'Líder Natã',
        'Líder Elines',
        'Líder Emilly',
        'Líder Isabele Cristina',
        'Líder Rayssa',
        'Líder Eldrinei',
        'Líder Eduardo Kyrk',
        'Líder Hudson',
      ],
    },
    {
      id: 'dept_louvor',
      name: 'Membros do louvor',
      kind: 'ministerio',
      order: 4,
      roleTitle: 'Ministério de Louvor',
      members: [
        'Diego',
        'Hildete',
        'Stelio',
        'Micilene',
        'Gabriele',
        'João Felipe',
        'W. Felipe',
        'Israel',
        'Angélica',
        'José',
        'Vinicius',
        'Eduardo Mateus',
        'Djanira',
      ],
    },
  ];

  const departments: Record<string, any> = {};
  const members: Record<string, any> = {};

  for (const g of groups) {
    departments[g.id] = {
      id: g.id,
      name: g.name,
      kind: g.kind,
      order: g.order,
      createdByUid: 'admin_pedro_martins',
      createdByName: 'Pedro Martins',
      createdAt: now,
      updatedAt: now,
    };

    g.members.forEach((memberName, idx) => {
      const memberId = `mem_${g.id}_${idx + 1}`;
      const memberCode = `PTB-MEM-${g.id.replace('dept_', '').toUpperCase()}-${String(idx + 1).padStart(2, '0')}`;
      members[memberId] = {
        id: memberId,
        departmentId: g.id,
        name: memberName,
        memberCode,
        roleTitle: g.roleTitle,
        congregation: 'IEADAM Petrópolis B',
        area: 'Sede / Geral',
        createdByUid: 'admin_pedro_martins',
        createdByName: 'Pedro Martins',
        createdAt: now,
        updatedAt: now,
      };
    });
  }

  return { departments, members };
}

function createInitialDb(): DbCollections {
  const now = new Date().toISOString();
  const db: DbCollections = {};
  for (const col of ALLOWED_COLLECTIONS) {
    db[col] = {};
  }

  db.users = {
    admin_pedro_martins: {
      uid: 'admin_pedro_martins',
      id: 'admin_pedro_martins',
      name: 'Pedro Martins',
      email: 'pedro.martinss225@gmail.com',
      role: 'super_admin',
      roleLabel: 'Super Administrador',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80',
      status: 'active',
      canManageChurchPage: true,
      canManageFinances: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: now,
    },
    Oq5l7PmQ4OMggXqy0Ue7eFfwp8f2: {
      uid: 'Oq5l7PmQ4OMggXqy0Ue7eFfwp8f2',
      id: 'Oq5l7PmQ4OMggXqy0Ue7eFfwp8f2',
      name: 'Emilly Campos',
      email: 'emillycampos308@gmail.com',
      role: 'super_admin',
      roleLabel: 'Super Administrador',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80',
      status: 'active',
      canManageChurchPage: true,
      canManageFinances: true,
      passwordHash: hashPassword('ptbmidia2026'),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: now,
    },
    EilJCOYZrkU0wYPTVrYPCY547kW2: {
      uid: 'EilJCOYZrkU0wYPTVrYPCY547kW2',
      id: 'EilJCOYZrkU0wYPTVrYPCY547kW2',
      name: 'Isabele Menezes',
      email: 'menezesisabele505@gmail.com',
      role: 'media_admin',
      roleLabel: 'Administrador',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&h=200&q=80',
      status: 'active',
      canManageChurchPage: true,
      canManageFinances: true,
      passwordHash: hashPassword('Isa180811'),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: now,
    },
    kh5UT2UEGDP8rYyiBjyx9gApFr32: {
      uid: 'kh5UT2UEGDP8rYyiBjyx9gApFr32',
      id: 'kh5UT2UEGDP8rYyiBjyx9gApFr32',
      name: 'Franciele Pinheiro',
      email: 'francielearaujopinheiro862@gmail.com',
      role: 'media_member',
      roleLabel: 'Membro da Mídia',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80',
      status: 'active',
      canManageChurchPage: false,
      passwordHash: hashPassword('Midiaptbfran'),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: now,
    },
  };

  db.settings = {
    system: {
      id: 'system',
      churchName: 'PT-B Mídia',
      churchSubtitle: 'Central de Arquivos e Mídias',
      storageEngine: 'Servidor Dedicado PT-B Mídia',
      totalQuotaBytes: 2 * 1024 * 1024 * 1024 * 1024,
      updatedAt: now,
    },
    attendance_roster_seeded: {
      seeded: true,
      updatedAt: now,
    },
  };

  db.church_settings = {
    profile: buildDefaultChurchProfile(),
  };

  const { departments, members } = buildInitialRoster(now);
  db.attendance_departments = departments;
  db.attendance_members = members;

  return db;
}

class LocalStore {
  private data: DbCollections;
  private lock: Promise<void> = Promise.resolve();
  private sseClients: Set<Response> = new Set();

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): DbCollections {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw) as DbCollections;
        const defaults = createInitialDb();
        for (const col of ALLOWED_COLLECTIONS) {
          if (!parsed[col] || typeof parsed[col] !== 'object') {
            parsed[col] = defaults[col] || {};
          }
        }
        // Ensure seeded users/settings exist if empty
        if (Object.keys(parsed.users).length === 0) {
          parsed.users = defaults.users;
        }
        if (!parsed.settings.system) {
          parsed.settings.system = defaults.settings.system;
        }
        if (!parsed.church_settings.profile) {
          parsed.church_settings.profile = defaults.church_settings.profile;
        }
        if (
          Object.keys(parsed.attendance_departments).length === 0 &&
          !parsed.settings.attendance_roster_seeded?.seeded
        ) {
          parsed.attendance_departments = defaults.attendance_departments;
          parsed.attendance_members = defaults.attendance_members;
          parsed.settings.attendance_roster_seeded = {
            seeded: true,
            updatedAt: new Date().toISOString(),
          };
        }
        return parsed;
      } catch (err) {
        console.error('[LocalStore] Failed reading db.json, recreating:', err);
      }
    }

    const initial = createInitialDb();
    this.writeSync(initial);
    return initial;
  }

  private writeSync(data: DbCollections) {
    const tmpPath = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, DB_FILE);
  }

  private async persist() {
    const tmpPath = `${DB_FILE}.${Date.now()}.tmp`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
    await fs.promises.rename(tmpPath, DB_FILE);
  }

  async withLock<T>(fn: (data: DbCollections) => Promise<T> | T): Promise<T> {
    const prev = this.lock;
    let release!: () => void;
    this.lock = new Promise<void>((res) => {
      release = res;
    });
    await prev;
    try {
      const result = await fn(this.data);
      await this.persist();
      return result;
    } finally {
      release();
    }
  }

  readSnapshot(): DbCollections {
    return this.data;
  }

  registerSseClient(res: Response) {
    this.sseClients.add(res);
    res.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  broadcastChange(collections: string | string[]) {
    const list = Array.isArray(collections) ? collections : [collections];
    const unique = Array.from(new Set(list));
    if (unique.length === 0) return;
    const payload = `data: ${JSON.stringify({ collections: unique, ts: Date.now() })}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  async seedAttendanceRoster(forceRestore = false) {
    await this.withLock((db) => {
      if (!forceRestore && db.settings.attendance_roster_seeded?.seeded) {
        return;
      }
      if (!forceRestore && Object.keys(db.attendance_departments).length > 0) {
        db.settings.attendance_roster_seeded = {
          seeded: true,
          updatedAt: new Date().toISOString(),
        };
        return;
      }
      const { departments, members } = buildInitialRoster(new Date().toISOString());
      for (const [k, v] of Object.entries(departments)) {
        db.attendance_departments[k] = v;
      }
      for (const [k, v] of Object.entries(members)) {
        db.attendance_members[k] = v;
      }
      db.settings.attendance_roster_seeded = {
        seeded: true,
        updatedAt: new Date().toISOString(),
      };
    });
    this.broadcastChange(['attendance_departments', 'attendance_members', 'settings']);
  }
}

export const localStore = new LocalStore();
