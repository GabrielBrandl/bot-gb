import { FormEvent, useEffect, useState } from "react";
import { Plus } from "lucide-react";
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
    load();
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

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }

  return (
    <div>
      <PageHeader
        title="Contatos"
        description="Gerencie sua base de clientes e leads."
        actions={
          <button type="button" className={btnPrimary} onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1.5 inline h-4 w-4" />
            Novo contato
          </button>
        }
      />

      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

      {showForm ? (
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-medium text-[var(--abs-blue-dark)]">Novo contato</h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Nome</span>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-[var(--abs-muted)]">Telefone</span>
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm text-[var(--abs-muted)]">E-mail (opcional)</span>
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {tags.length > 0 ? (
              <div className="space-y-2 sm:col-span-2">
                <span className="text-sm text-[var(--abs-muted)]">Tags</span>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`rounded-full px-3 py-1 text-xs transition ${
                        selectedTags.includes(tag.id)
                          ? "bg-[var(--abs-yellow)]/25 text-[var(--abs-blue)] ring-1 ring-[var(--abs-blue)]/30"
                          : "bg-[var(--abs-bg)] text-[var(--abs-muted)] hover:bg-slate-700"
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
                {submitting ? "Salvando..." : "Salvar"}
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
        <div className="overflow-x-auto rounded-xl border border-[var(--abs-gray)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--abs-gray)] bg-[var(--abs-bg)] text-left text-[var(--abs-muted)]">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Tags</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="border-b border-[var(--abs-gray)]/50 hover:bg-white/50">
                  <td className="px-4 py-3 text-[var(--abs-blue-dark)]">{contact.name}</td>
                  <td className="px-4 py-3 text-slate-600">{contact.phone}</td>
                  <td className="px-4 py-3 text-[var(--abs-muted)]">{contact.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags?.length ? (
                        contact.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full bg-[var(--abs-bg)] px-2 py-0.5 text-xs text-slate-600"
                          >
                            {tag.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
