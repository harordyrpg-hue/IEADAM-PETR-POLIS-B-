import React, { useState } from 'react';
import { X, Calendar, User, Tag, Image as ImageIcon } from 'lucide-react';
import { ChurchEvent } from '../../types.js';
import { api } from '../../services/api.js';
import { useApp } from '../../context/AppContext.js';

interface EventModalProps {
  event?: ChurchEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EVENT_CATEGORIES = [
  'Culto de Domingo',
  'Culto de Celebração',
  'Conferência',
  'Congresso',
  'Retiro',
  'Batismo',
  'Casamento',
  'Evento de Jovens',
  'Evento Infantil',
  'Evangelismo',
  'Ação Social',
];

export const EventModal: React.FC<EventModalProps> = ({
  event,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { notify } = useApp();

  const [name, setName] = useState(event ? event.name : '');
  const [description, setDescription] = useState(event ? event.description : '');
  const [date, setDate] = useState(event ? event.date : new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState(event ? event.category : 'Culto de Domingo');
  const [responsibles, setResponsibles] = useState(event ? event.responsibles.join(', ') : '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date) {
      notify('Preencha os campos obrigatórios', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const parsedResponsibles = responsibles
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

      if (event) {
        await api.updateEvent(event.id, {
          name: name.trim(),
          description: description.trim(),
          date,
          category,
          responsibles: parsedResponsibles,
        });
        notify('Evento atualizado com sucesso!', 'success');
      } else {
        await api.createEvent({
          name: name.trim(),
          description: description.trim(),
          date,
          category,
          coverUrl: '/assets/images/church_worship_stage_1790831714044.jpg',
          responsibles: parsedResponsibles,
        });
        notify('Novo evento da igreja criado com sucesso!', 'success');
      }

      onSuccess();
      onClose();
    } catch {
      notify('Erro ao salvar evento', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 text-neutral-100 text-xs animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-sm">{event ? 'Editar Evento' : 'Novo Evento da Igreja'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-4 space-y-3.5">
          <div>
            <label className="block text-neutral-300 font-medium mb-1">Nome do Evento: *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Culto de Domingo — Celebração"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-medium mb-1">Data: *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-medium mb-1">Categoria:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-amber-500"
              >
                {EVENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">Descrição / Observações:</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Cobertura de fotos do culto das 18h, gravação 4K e fotos dos batizados."
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">
              Responsáveis da Equipe (separados por vírgula):
            </label>
            <input
              type="text"
              value={responsibles}
              onChange={(e) => setResponsibles(e.target.value)}
              placeholder="Ex: Pedro Henrique, João, Equipe de Louvor"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold rounded-lg shadow-sm"
            >
              {event ? 'Atualizar Evento' : 'Criar Evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
