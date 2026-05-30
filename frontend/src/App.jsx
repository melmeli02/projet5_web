import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, useParams } from 'react-router-dom'

// ─────────────────────────────────────────
// API — toutes les fonctions fetch ici
// ─────────────────────────────────────────
const BASE = '/api'

async function request(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erreur serveur')
  return data
}

const api = {
  getMembres:      ()         => request('GET',    '/membres'),
  createMembre:    (d)        => request('POST',   '/membres', d),
  getMembre:       (id)       => request('GET',    `/membres/${id}`),
  getProjets:      ()         => request('GET',    '/projets'),
  getProjet:       (id)       => request('GET',    `/projets/${id}`),
  createProjet:    (d)        => request('POST',   '/projets', d),
  updateProjet:    (id, d)    => request('PUT',    `/projets/${id}`, d),
  deleteProjet:    (id)       => request('DELETE', `/projets/${id}`),
  getTaches:       (pid)      => request('GET',    `/projets/${pid}/taches`),
  createTache:     (pid, d)   => request('POST',   `/projets/${pid}/taches`, d),
  updateTache:     (id, d)    => request('PUT',    `/taches/${id}`, d),
  deleteTache:     (id)       => request('DELETE', `/taches/${id}`),
  getDashboard:    ()         => request('GET',    '/dashboard'),
}

// ─────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────
function Nav() {
  const loc = useLocation()
  return (
    <nav className="navbar">
      <Link to="/" className="brand">Projet 5 — Gestionnaire de Projets & Tâches</Link>
      <div className="nav-links">
        {[['/', 'Dashboard'], ['/projets', 'Projets'], ['/membres', 'Membres']].map(([to, label]) => (
          <Link key={to} to={to} className={loc.pathname === to ? 'nav-link active' : 'nav-link'}>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

// ─────────────────────────────────────────
// PAGE DASHBOARD
// ─────────────────────────────────────────
function Dashboard() {
  const [stats, setStats]   = useState(null)
  const [projets, setProjets] = useState([])
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    Promise.all([api.getDashboard(), api.getProjets()])
      .then(([s, p]) => { setStats(s); setProjets(p) })
      .catch(e => setErreur(e.message))
  }, [])

  if (erreur) return <div className="erreur" style={{ margin: '40px auto', maxWidth: 500 }}>Impossible de contacter le serveur : {erreur}</div>
  if (!stats) return <p className="loading">Chargement…</p>

  const { taches_par_statut: t } = stats

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">Vue d'ensemble de vos projets et tâches</p>

      <div className="stats-grid">
        {[
          { label: 'Projets',      val: stats.total_projets,   color: '#4f7cff' },
          { label: 'Tâches',       val: stats.total_taches,    color: '#2ec4b6' },
          { label: 'En cours',     val: t['en_cours']  || 0,   color: '#a78bfa' },
          { label: 'À faire',      val: t['à_faire']   || 0,   color: '#f4a261' },
        ].map(({ label, val, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-val" style={{ color }}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="dash-row">
        <div className="card">
          <h3 className="card-title">Répartition des tâches</h3>
          {[
            { key: 'à_faire',  label: 'À faire',   color: '#64748b' },
            { key: 'en_cours', label: 'En cours',  color: '#a78bfa' },
            { key: 'terminé',  label: 'Terminées', color: '#2ec4b6' },
          ].map(({ key, label, color }) => {
            const pct = stats.total_taches > 0
              ? Math.round(((t[key] || 0) / stats.total_taches) * 100) : 0
            return (
              <div key={key} className="progress-row">
                <div className="progress-meta">
                  <span>{label}</span>
                  <span style={{ color }}>{t[key] || 0}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="card">
          <h3 className="card-title">Projets récents</h3>
          {projets.length === 0
            ? <p className="empty">Aucun projet</p>
            : projets.slice(0, 5).map(p => (
              <div key={p.id} className="projet-row">
                <div>
                  <div className="projet-row-name">{p.nom}</div>
                  <div className="projet-row-meta">{p.nb_taches} tâches · {p.nb_terminees} terminées</div>
                </div>
                <span className={`badge badge-${p.statut}`}>{p.statut}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// PAGE PROJETS
// ─────────────────────────────────────────
function Projets() {
  const [projets, setProjets] = useState([])
  const [filtre, setFiltre]   = useState('tous')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nom: '', description: '', date_debut: '', date_fin_prevue: '', statut: 'actif' })
  const [erreur, setErreur]   = useState(null)
  const [errLoad, setErrLoad] = useState(null)

  useEffect(() => {
    api.getProjets().then(setProjets).catch(e => setErrLoad(e.message))
  }, [])

  const projetsFiltres = filtre === 'tous' ? projets : projets.filter(p => p.statut === filtre)

  const changerStatutProjet = async (id, statut) => {
    const ancien = projets.find(p => p.id === id)?.statut
    setProjets(ps => ps.map(p => p.id === id ? { ...p, statut } : p))
    try {
      await api.updateProjet(id, { statut })
    } catch {
      setProjets(ps => ps.map(p => p.id === id ? { ...p, statut: ancien } : p))
    }
  }

  const creer = async () => {
    setErreur(null)
    try {
      const p = await api.createProjet(form)
      setProjets(ps => [p, ...ps])
      setShowForm(false)
      setForm({ nom: '', description: '', date_debut: '', date_fin_prevue: '', statut: 'actif' })
    } catch (e) { setErreur(e.message) }
  }

  const supprimer = async (id) => {
    if (!confirm('Supprimer ce projet et toutes ses tâches ?')) return
    await api.deleteProjet(id)
    setProjets(ps => ps.filter(p => p.id !== id))
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projets</h1>
          <p className="page-sub">{projets.length} projet{projets.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Annuler' : '+ Nouveau projet'}
        </button>
      </div>

      {errLoad && <div className="erreur">Impossible de charger les projets : {errLoad}</div>}

      {showForm && (
        <div className="card form-card">
          {erreur && <div className="erreur">{erreur}</div>}
          <div className="form-group">
            <label>Nom *</label>
            <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Nom du projet" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description…" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Date début *</label>
              <input type="date" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Date fin prévue *</label>
              <input type="date" value={form.date_fin_prevue} onChange={e => setForm(f => ({ ...f, date_fin_prevue: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Statut</label>
            <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
              <option value="actif">Actif</option>
              <option value="en_pause">En pause</option>
              <option value="terminé">Terminé</option>
            </select>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button className="btn btn-primary" onClick={creer}>Créer le projet</button>
          </div>
        </div>
      )}

      <div className="filtres">
        {['tous', 'actif', 'en_pause', 'terminé'].map(s => (
          <button key={s} className={filtre === s ? 'filtre-btn actif' : 'filtre-btn'} onClick={() => setFiltre(s)}>
            {s === 'tous' ? 'Tous' : s}
          </button>
        ))}
        <span className="filtre-count">{projetsFiltres.length} résultat{projetsFiltres.length !== 1 ? 's' : ''}</span>
      </div>

      {projetsFiltres.length === 0
        ? <div className="empty">Aucun projet{filtre !== 'tous' ? ` avec le statut "${filtre}"` : ''}</div>
        : (
          <div className="projets-grid">
            {projetsFiltres.map(p => {
              const pct = p.nb_taches > 0 ? Math.round((p.nb_terminees / p.nb_taches) * 100) : 0
              return (
                <div key={p.id} className="projet-card">
                  <div className="projet-card-top">
                    <select
                      value={p.statut}
                      onChange={e => changerStatutProjet(p.id, e.target.value)}
                      className={`statut-select statut-select-${p.statut}`}
                    >
                      <option value="actif">actif</option>
                      <option value="en_pause">en_pause</option>
                      <option value="terminé">terminé</option>
                    </select>
                    <button className="btn-delete" onClick={() => supprimer(p.id)}>✕</button>
                  </div>
                  <h3 className="projet-card-title">{p.nom}</h3>
                  {p.description && <p className="projet-card-desc">{p.description}</p>}
                  <div className="projet-card-meta">
                    <span>📅 {p.date_fin_prevue}</span>
                    <span>{p.nb_taches} tâche{p.nb_taches !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="progress-row" style={{ marginTop: 8 }}>
                    <div className="progress-track" style={{ flex: 1 }}>
                      <div className="progress-fill" style={{ width: `${pct}%`, background: '#2ec4b6' }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>{pct}%</span>
                  </div>
                  <Link to={`/projets/${p.id}`} className="btn btn-ghost" style={{ marginTop: 12, textAlign: 'center' }}>
                    Voir les tâches →
                  </Link>
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

// ─────────────────────────────────────────
// PAGE DÉTAIL PROJET (Kanban)
// ─────────────────────────────────────────
const STATUTS = ['à_faire', 'en_cours', 'terminé']
const LABELS  = { 'à_faire': 'À faire', 'en_cours': 'En cours', 'terminé': 'Terminé' }
const SUIVANT = { 'à_faire': 'en_cours', 'en_cours': 'terminé', 'terminé': 'à_faire' }
const BTN_LABEL = { 'à_faire': '▶ Démarrer', 'en_cours': '✓ Terminer', 'terminé': '↺ Rouvrir' }

function ProjetDetail() {
  const { id } = useParams()
  const [projet, setProjet]   = useState(null)
  const [taches, setTaches]   = useState([])
  const [membres, setMembres] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titre: '', description: '', membre_id: '', priorite: 'moyenne', statut: 'à_faire' })
  const [erreur, setErreur]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [errLoad, setErrLoad] = useState(null)
  const [editId, setEditId]   = useState(null)
  const [editForm, setEditForm] = useState({})

  useEffect(() => {
    Promise.all([api.getProjet(id), api.getTaches(id), api.getMembres()])
      .then(([p, ts, ms]) => {
        setProjet(p)
        setTaches(ts)
        setMembres(ms)
        setLoading(false)
      })
      .catch(e => { setErrLoad(e.message); setLoading(false) })
  }, [id])

  const startEdit = (tache) => {
    setEditId(tache.id)
    setEditForm({ titre: tache.titre, description: tache.description || '', membre_id: String(tache.membre_id), priorite: tache.priorite })
  }

  const saveEdit = async (tache) => {
    try {
      const updated = await api.updateTache(tache.id, { ...editForm, membre_id: parseInt(editForm.membre_id) })
      setTaches(ts => ts.map(t => t.id === updated.id ? updated : t))
      setEditId(null)
    } catch (e) { setErreur(e.message) }
  }

  const changerStatut = async (tache) => {
    const updated = await api.updateTache(tache.id, { statut: SUIVANT[tache.statut] })
    setTaches(ts => ts.map(t => t.id === updated.id ? updated : t))
  }

  const supprimerTache = async (tid) => {
    if (!confirm('Supprimer cette tâche ?')) return
    await api.deleteTache(tid)
    setTaches(ts => ts.filter(t => t.id !== tid))
  }

  const creerTache = async () => {
    setErreur(null)
    try {
      const t = await api.createTache(id, { ...form, membre_id: parseInt(form.membre_id) })
      setTaches(ts => [...ts, t])
      setShowForm(false)
      setForm({ titre: '', description: '', membre_id: '', priorite: 'moyenne', statut: 'à_faire' })
    } catch (e) { setErreur(e.message) }
  }

  if (loading) return <p className="loading">Chargement du projet…</p>
  if (errLoad) return <div className="erreur" style={{ margin: '40px auto', maxWidth: 500 }}>Impossible de charger le projet : {errLoad}</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><Link to="/projets">Projets</Link> › {projet?.nom}</div>
          <h1 className="page-title">{projet?.nom}</h1>
          {projet && <span className={`badge badge-${projet.statut}`} style={{ marginTop: 6, display: 'inline-flex' }}>{projet.statut}</span>}
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Annuler' : '+ Nouvelle tâche'}
        </button>
      </div>

      {showForm && (
        <div className="card form-card">
          {erreur && <div className="erreur">{erreur}</div>}
          <div className="form-group">
            <label>Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="Titre de la tâche" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description…" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Assigné à *</label>
              <select value={form.membre_id} onChange={e => setForm(f => ({ ...f, membre_id: e.target.value }))}>
                <option value="">Choisir un membre</option>
                {membres.map(m => <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Priorité</label>
              <select value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}>
                <option value="basse">Basse</option>
                <option value="moyenne">Moyenne</option>
                <option value="haute">Haute</option>
              </select>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button className="btn btn-primary" onClick={creerTache}>Créer la tâche</button>
          </div>
        </div>
      )}

      <div className="kanban">
        {STATUTS.map(statut => (
          <div key={statut} className={`kanban-col kanban-${statut.replace('_', '-')}`}>
            <div className="kanban-header">
              <span>{LABELS[statut]}</span>
              <span className="kanban-count">{taches.filter(t => t.statut === statut).length}</span>
            </div>
            {taches.filter(t => t.statut === statut).map(t => (
              <div key={t.id} className="tache-card">
                {editId === t.id ? (
                  <div className="tache-edit">
                    <input value={editForm.titre} onChange={e => setEditForm(f => ({...f, titre: e.target.value}))} placeholder="Titre" />
                    <textarea value={editForm.description} onChange={e => setEditForm(f => ({...f, description: e.target.value}))} placeholder="Description…" />
                    <select value={editForm.membre_id} onChange={e => setEditForm(f => ({...f, membre_id: e.target.value}))}>
                      {membres.map(m => <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>)}
                    </select>
                    <select value={editForm.priorite} onChange={e => setEditForm(f => ({...f, priorite: e.target.value}))}>
                      <option value="basse">Basse</option>
                      <option value="moyenne">Moyenne</option>
                      <option value="haute">Haute</option>
                    </select>
                    <div style={{display: 'flex', gap: 6, justifyContent: 'flex-end'}}>
                      <button className="btn btn-primary btn-sm" onClick={() => saveEdit(t)}>Sauvegarder</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="tache-top">
                      <span className={`badge badge-${t.priorite}`}>{t.priorite}</span>
                      <div style={{display: 'flex', gap: 4}}>
                        <button className="btn-delete" title="Modifier" onClick={() => startEdit(t)}>✎</button>
                        <button className="btn-delete" onClick={() => supprimerTache(t.id)}>✕</button>
                      </div>
                    </div>
                    <div className="tache-titre">{t.titre}</div>
                    {t.description && <div className="tache-desc">{t.description}</div>}
                    <div className="tache-footer">
                      <span className="tache-membre">👤 {t.membre_nom || '—'}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => changerStatut(t)}>
                        {BTN_LABEL[t.statut]}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {taches.filter(t => t.statut === statut).length === 0 && (
              <div className="kanban-empty">Aucune tâche</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// PAGE MEMBRES
// ─────────────────────────────────────────
function Membres() {
  const [membres, setMembres] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', role: '' })
  const [erreur, setErreur]   = useState(null)
  const [errLoad, setErrLoad] = useState(null)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail]   = useState(null)

  useEffect(() => {
    api.getMembres().then(setMembres).catch(e => setErrLoad(e.message))
  }, [])

  const creer = async () => {
    setErreur(null)
    try {
      const m = await api.createMembre(form)
      setMembres(ms => [...ms, m])
      setShowForm(false)
      setForm({ nom: '', prenom: '', email: '', role: '' })
    } catch (e) { setErreur(e.message) }
  }

  const voirDetail = async (m) => {
    setSelected(m)
    const d = await api.getMembre(m.id)
    setDetail(d)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Membres</h1>
          <p className="page-sub">{membres.length} membre{membres.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Annuler' : '+ Nouveau membre'}
        </button>
      </div>

      {showForm && (
        <div className="card form-card">
          {erreur && <div className="erreur">{erreur}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Prénom *</label>
              <input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} placeholder="Prénom" />
            </div>
            <div className="form-group">
              <label>Nom *</label>
              <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Nom" />
            </div>
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemple.com" />
          </div>
          <div className="form-group">
            <label>Rôle *</label>
            <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Développeur, Designer…" />
          </div>
          <div style={{ textAlign: 'right' }}>
            <button className="btn btn-primary" onClick={creer}>Créer le membre</button>
          </div>
        </div>
      )}

      {errLoad && <div className="erreur">Impossible de charger les membres : {errLoad}</div>}
      {membres.length === 0 && !errLoad && <div className="empty">Aucun membre. Ajoutez votre premier membre !</div>}
      <div className="membres-grid">
        {membres.map(m => (
          <div key={m.id} className="membre-card" onClick={() => voirDetail(m)}>
            <div className="membre-avatar">{m.prenom[0]}{m.nom[0]}</div>
            <div>
              <div className="membre-name">{m.prenom} {m.nom}</div>
              <div className="membre-role">{m.role}</div>
              <div className="membre-email">{m.email}</div>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => { setSelected(null); setDetail(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{selected.prenom} {selected.nom}</h2>
            <p style={{ color: 'var(--text2)', marginBottom: 16 }}>{selected.role} · {selected.email}</p>
            <h3 style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 12 }}>Tâches en cours</h3>
            {!detail
              ? <p className="loading">Chargement…</p>
              : detail.taches_en_cours?.length === 0
                ? <p className="empty">Aucune tâche en cours</p>
                : detail.taches_en_cours?.map(t => (
                  <div key={t.id} className="tache-row-membre">
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{t.titre}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t.projet_nom || `Projet #${t.projet_id}`}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span className={`badge badge-${t.statut}`}>{t.statut}</span>
                      <span className={`badge badge-${t.priorite}`}>{t.priorite}</span>
                    </div>
                  </div>
                ))
            }
            <div style={{ textAlign: 'right', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => { setSelected(null); setDetail(null) }}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// APP — routing principal
// ─────────────────────────────────────────
function Footer() {
  return (
    <footer className="footer">
      Emma NEDELEC · Melissa TRESO · Harold MALHERBE · Clara JULIEN
    </footer>
  )
}
export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="main-content">
        <Routes>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/projets"     element={<Projets />} />
          <Route path="/projets/:id" element={<ProjetDetail />} />
          <Route path="/membres"     element={<Membres />} />
        </Routes>
</main>
      <Footer />
    </BrowserRouter>
  )
}