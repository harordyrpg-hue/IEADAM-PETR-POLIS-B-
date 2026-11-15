import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldAlert,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Check,
  X,
  Key,
  Church,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { User, UserRole } from '../../types.js';
import { formatDate, getRoleBadgeStyle } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

export const UsersView: React.FC = () => {
  const { user, notify, requestConfirm } = useApp();
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('media_member');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('media_member');

  const isSuperAdmin = user?.role === 'super_admin';

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsersList(data);
    } catch {
      notify('Erro ao carregar equipe', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    if (newUserPassword.length < 6) {
      notify('A senha inicial precisa ter no mínimo 6 dígitos.', 'error');
      return;
    }

    try {
      await api.createTeamUser({
        name: newUserName.trim(),
        email: newUserEmail.trim().toLowerCase(),
        initialPassword: newUserPassword,
        role: newUserRole,
      });
      notify('Novo membro criado com sucesso no Firebase Authentication!', 'success');
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setIsAddUserOpen(false);
      loadUsers();
    } catch (err: any) {
      notify(err.message || 'Erro ao adicionar membro', 'error');
    }
  };

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    try {
      await api.updateUserRole(userId, role);
      notify('Permissão do usuário atualizada com sucesso no Firestore', 'success');
      setEditingUserId(null);
      loadUsers();
    } catch {
      notify('Erro ao atualizar permissão', 'error');
    }
  };

  const handleToggleBlock = async (userItem: User) => {
    const newStatus = userItem.status === 'active' ? 'blocked' : 'active';
    try {
      await api.setUserStatus(userItem.uid, newStatus);
      notify(`Usuário ${newStatus === 'active' ? 'desbloqueado' : 'bloqueado'} com sucesso`, 'info');
      loadUsers();
    } catch {
      notify('Erro ao alterar status', 'error');
    }
  };

  const handleToggleChurchPermission = async (userItem: User) => {
    const newValue = !userItem.canManageChurchPage;
    try {
      await api.updateUserChurchPermission(userItem.uid, newValue);
      notify(
        `Permissão da página da igreja ${newValue ? 'concedida a' : 'removida de'} ${userItem.name}`,
        'success'
      );
      loadUsers();
    } catch {
      notify('Erro ao atualizar permissão da página da igreja', 'error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmed = await requestConfirm({
      title: 'Remover membro da equipe',
      message: 'Remover este usuário da equipe? Esta ação não pode ser desfeita.',
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await api.deleteTeamUser(userId);
      notify('Usuário removido da equipe', 'info');
      loadUsers();
    } catch {
      notify('Erro ao remover usuário', 'error');
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-12 text-center text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg mx-auto mt-8">
        <ShieldAlert className="w-8 h-8 text-amber-500/80 mx-auto mb-3" />
        <h2 className="text-sm font-bold text-neutral-200">Acesso Restrito</h2>
        <p className="mt-1 text-neutral-400 leading-relaxed">
          O cadastro e gerenciamento de membros é exclusivo para o Super Administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-neutral-100">
            Equipe e Permissões
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Contas, níveis de acesso e autorizações ({usersList.length} membros).
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="flex items-center justify-center gap-2 px-4 min-h-[40px] bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs transition-all shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Adicionar membro</span>
          </button>
        )}
      </div>

      {/* Hairline Permissions Legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-neutral-800 border border-neutral-800 rounded-2xl overflow-hidden">
        <div className="p-4 bg-neutral-900">
          <div className="text-amber-400 font-semibold text-xs mb-1">
            Super Administrador
          </div>
          <p className="text-[11px] text-neutral-400">
            Controle total sobre usuários, permissões e configurações.
          </p>
        </div>

        <div className="p-4 bg-neutral-900">
          <div className="text-blue-400 font-semibold text-xs mb-1">
            Administrador de Mídia
          </div>
          <p className="text-[11px] text-neutral-400">
            Criação de eventos, pastas e organização de arquivos.
          </p>
        </div>

        <div className="p-4 bg-neutral-900">
          <div className="text-neutral-200 font-semibold text-xs mb-1">
            Membro da Mídia
          </div>
          <p className="text-[11px] text-neutral-400">
            Visualização, envio de arquivos originais e compartilhamento.
          </p>
        </div>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-neutral-400">Carregando membros...</div>
      ) : (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-neutral-800">
            {usersList.map((u) => {
              const roleBadge = getRoleBadgeStyle(u.role);
              const isEditingThis = editingUserId === u.uid;
              const initials = (u.name || 'M').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

              return (
                <div key={u.uid} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.name}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover ring-1 ring-neutral-700 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-neutral-100 text-sm truncate">{u.name}</p>
                        <p className="text-[11px] text-neutral-400 font-mono truncate">{u.email}</p>
                      </div>
                    </div>

                    <span className={`text-[11px] font-medium shrink-0 ${u.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {u.status === 'active' ? 'Ativo' : 'Bloqueado'}
                    </span>
                  </div>

                  {isEditingThis ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as UserRole)}
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-2.5 min-h-[36px] text-xs text-neutral-200"
                      >
                        <option value="super_admin">Super Administrador</option>
                        <option value="media_admin">Administrador de Mídia</option>
                        <option value="media_member">Membro da Mídia</option>
                      </select>
                      <button
                        onClick={() => handleUpdateRole(u.uid, editRole)}
                        className="p-2 bg-amber-400 text-neutral-950 rounded-xl cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingUserId(null)}
                        className="p-2 bg-neutral-800 text-neutral-300 rounded-xl cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-medium ${roleBadge.textClass}`}>
                          {u.roleLabel}
                        </span>
                        {u.role !== 'super_admin' && isSuperAdmin && (
                          <button
                            onClick={() => handleToggleChurchPermission(u)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-medium border cursor-pointer ${
                              u.canManageChurchPage
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                            }`}
                          >
                            {u.canManageChurchPage ? 'Site: Sim' : 'Site: Não'}
                          </button>
                        )}
                      </div>

                      {isSuperAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingUserId(u.uid);
                              setEditRole(u.role);
                            }}
                            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl cursor-pointer"
                            title="Alterar permissões"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleBlock(u)}
                            className="p-2 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-xl cursor-pointer"
                            title={u.status === 'active' ? 'Bloquear' : 'Desbloquear'}
                          >
                            {u.status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.uid)}
                            className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-xl cursor-pointer"
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-200">
              <thead className="bg-neutral-950/50 text-[11px] font-medium text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Membro</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Acesso</th>
                  <th className="px-4 py-3">Site da Igreja</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Desde</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/70">
                {usersList.map((u) => {
                  const roleBadge = getRoleBadgeStyle(u.role);
                  const isEditingThis = editingUserId === u.uid;
                  const initials = (u.name || 'M').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

                  return (
                    <tr key={u.uid} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt={u.name}
                              referrerPolicy="no-referrer"
                              className="w-7 h-7 rounded-full object-cover ring-1 ring-neutral-700"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-amber-500/15 text-amber-400 font-bold text-[10px] flex items-center justify-center">
                              {initials}
                            </div>
                          )}
                          <span className="font-semibold text-neutral-200">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-400 font-mono text-[11px]">
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        {isEditingThis ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value as UserRole)}
                              className="bg-neutral-800 border border-neutral-700 rounded-lg p-1.5 text-xs text-neutral-200"
                            >
                              <option value="super_admin">Super Administrador</option>
                              <option value="media_admin">Administrador de Mídia</option>
                              <option value="media_member">Membro da Mídia</option>
                            </select>
                            <button
                              onClick={() => handleUpdateRole(u.uid, editRole)}
                              className="p-1.5 bg-amber-400 text-neutral-950 rounded-lg hover:bg-amber-300 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="p-1.5 bg-neutral-800 text-neutral-300 rounded-lg hover:bg-neutral-700 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className={`font-medium ${roleBadge.textClass}`}>
                            {u.roleLabel}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.role === 'super_admin' ? (
                          <span className="text-[11px] text-amber-300 font-medium">
                            Super Admin
                          </span>
                        ) : isSuperAdmin ? (
                          <button
                            onClick={() => handleToggleChurchPermission(u)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                              u.canManageChurchPage
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                                : 'bg-neutral-800/80 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                            }`}
                          >
                            <span>{u.canManageChurchPage ? 'Autorizado' : 'Não autorizado'}</span>
                          </button>
                        ) : (
                          <span className={`text-[11px] font-medium ${u.canManageChurchPage ? 'text-emerald-400' : 'text-neutral-500'}`}>
                            {u.canManageChurchPage ? 'Autorizado' : 'Não autorizado'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-medium ${u.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {u.status === 'active' ? 'Ativo' : 'Bloqueado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-400 font-mono tabular-nums">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isSuperAdmin && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingUserId(u.uid);
                                  setEditRole(u.role);
                                }}
                                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg cursor-pointer"
                                title="Alterar permissões"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleToggleBlock(u)}
                                className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-lg cursor-pointer"
                                title={u.status === 'active' ? 'Bloquear usuário' : 'Desbloquear usuário'}
                              >
                                {u.status === 'active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                onClick={() => handleDeleteUser(u.uid)}
                                className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg cursor-pointer"
                                title="Remover usuário"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl text-neutral-100 text-xs">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-amber-400" />
              Novo Membro da Equipe de Mídia (Firebase Auth)
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Nome Completo: *</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Ex: Gabriel Santos"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">E-mail de Acesso: *</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Ex: gabriel.midia@ptb.church"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Senha Inicial de Acesso: *</label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="password"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Papel / Nível de Acesso:</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="media_member">Membro da Mídia (Upload e visualização)</option>
                  <option value="media_admin">Administrador de Mídia (Organização e eventos)</option>
                  <option value="super_admin">Super Administrador (Controle irrestrito)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold rounded-lg shadow-sm"
                >
                  Criar Membro no Firebase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
