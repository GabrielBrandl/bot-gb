import { FormEvent, useEffect, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { contactsApi, tagsApi } from "../lib/api";
import type { Contact, Tag } from "../lib/types";
import {
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  ErrorState,
  inputClass,
  LoadingState,
  PageHeader,
} from "../components/ui/PageHeader";

export function ContactsPage() {
  const { token } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [c, t] = await Promise.all([contactsApi.list(token), tagsApi.list(token)]);
      setContacts(c);
      setTags(t);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar contatos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await contactsApi.create(token, {
        name,
        phone,
        email: email || undefined,
        tagIds: selectedTags.length ? selectedTags : undefined,
      });
      setName("");
      setPhone("");
      setEmail("");
      setSelectedTags([]);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar contato");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(contact: Contact) {
    setEditingId(contact.id);
    setEditingName(contact.name ?? "");
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function saveName(contactId: string) {
    if (!token) return;
    const next = editingName.trim();
    if (!next) {
      setError("Informe um nome para o contato.");
      return;
    }
    setSavingId(contactId);
    try {
      const updated = await contactsApi.update(token, contactId, { name: next });
      setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, ...updated } : c)));
      setEditingId(null);
      setEditingName("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar nome");
    } finally {
      setSavingId(null);
    }
  }

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }

  return (
    <div>
      <PageHeader
        title="Contatos"
        description="Gerencie sua base de clientes e leads. Clique no lápis para editar o nome."
        actions={
          <button type="button" className={btnPrimary} onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1.5 inline h-4 w-4" />
            Novo contato
          </button>
        }
      />

      {error ? (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      {showForm ? (
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-medium text-[var(--gb-text)]">Novo contato</h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm text-[var(--gb-muted)]">Nome</span>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-[var(--gb-muted)]">Telefone</span>
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm text-[var(--gb-muted)]">E-mail (opcional)</span>
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {tags.length > 0 ? (
              <div className="space-y-2 sm:col-span-2">
                <span className="text-sm text-[var(--gb-muted)]">Tags</span>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`rounded-full px-3 py-1 text-xs transition ${
                        selectedTags.includes(tag.id)
                          ? "gb-gradient text-white"
                          : "bg-[var(--gb-surface-2)] text-[var(--gb-muted)]"
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className={btnPrimary} disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar contato"}
              </button>
              <button type="button" className={btnSecondary} onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : contacts.length === 0 ? (
        <EmptyState message="Nenhum contato cadastrado." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--gb-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--gb-border)] bg-[var(--gb-surface)] text-left text-[var(--gb-muted)]">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Tags</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => {
                const isEditing = editingId === contact.id;
                return (
                  <tr key={contact.id} className="border-b border-[var(--gb-border)]/50 hover:bg-[var(--gb-surface-2)]/40">
                    <td className="px-4 py-3 text-[var(--gb-text)]">
                      {isEditing ? (
                        <input
                          className={`${inputClass} max-w-xs`}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void saveName(contact.id);
                            }
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                          disabled={savingId === contact.id}
                        />
                      ) : (
                        contact.name || <span className="text-[var(--gb-muted)]">Sem nome</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--gb-muted)]">{contact.phone}</td>
                    <td className="px-4 py-3 text-[var(--gb-muted)]">{contact.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {contact.tags?.length ? (
                          contact.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-full bg-[var(--gb-surface-2)] px-2 py-0.5 text-xs text-[var(--gb-muted)]"
                            >
                              {tag.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[var(--gb-muted)]">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className={btnPrimary}
                            title="Salvar nome"
                            disabled={savingId === contact.id}
                            onClick={() => void saveName(contact.id)}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button type="button" className={btnSecondary} title="Cancelar" onClick={cancelEdit}>
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={btnSecondary}
                          title="Editar nome"
                          onClick={() => startEdit(contact)}
                        >
                          <Pencil className="mr-1 inline h-3.5 w-3.5" />
                          Editar nome
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
