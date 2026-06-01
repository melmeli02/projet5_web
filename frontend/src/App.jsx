import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, useParams } from 'react-router-dom'

// ─────────────────────────────────────────
// APPELS API — fonctions qui communiquent avec le backend
// ─────────────────────────────────────────

const BASE = '/api'

// Fonction générique : envoie une requête HTTP et retourne les données JSON
async function request(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) {
    options.body = JSON.stringify(body)
  }

  const reponse = await fetch(BASE + path, options)
  const data = await reponse.json()

  if (!reponse.ok) {
    throw new Error(data.error || 'Erreur serveur')
  }
  return data
}

// Fonctions nommées pour chaque appel API
function getMembres()          { return request('GET',    '/membres') }
function createMembre(data)    { return request('POST',   '/membres', data) }
function getMembre(id)         { return request('GET',    `/membres/${id}`) }
function getProjets()          { return request('GET',    '/projets') }
function getProjet(id)         { return request('GET',    `/projets/${id}`) }
function createProjet(data)    { return request('POST',   '/projets', data) }
function updateProjet(id, data){ return request('PUT',    `/projets/${id}`, data) }
function deleteProjet(id)      { return request('DELETE', `/projets/${id}`) }
function getTaches(projetId)   { return request('GET',    `/projets/${projetId}/taches`) }
function createTache(pid, data){ return request('POST',   `/projets/${pid}/taches`, data) }
function updateTache(id, data) { return request('PUT',    `/taches/${id}`, data) }
function deleteTache(id)       { return request('DELETE', `/taches/${id}`) }
function getDashboard()        { return request('GET',    '/dashboard') }


// ─────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────

function Nav() {
  const loc = useLocation()
  const liens = [
    ['/',        'Dashboard'],
    ['/projets', 'Projets'],
    ['/membres', 'Membres'],
  ]

  return (
    <nav className="navbar">
      <Link to="/" className="brand">Projet 5 — Gestionnaire de Projets & Tâches</Link>
      <div className="nav-links">
        {liens.map(([to, label]) => (
          <Link
            key={to}
            to={to}
            className={loc.pathname === to ? 'nav-link active' : 'nav-link'}
          >
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
  const [stats, setStats]     = useState(null)
  const [projets, setProjets] = useState([])
  const [erreur, setErreur]   = useState(null)

  useEffect(() => {
    Promise.all([getDashboard(), getProjets()])
      .then(([s, p]) => {
        setStats(s)
        setProjets(p)
      })
      .catch(e => setErreur(e.message))
  }, [])

  if (erreur) {
    return <div className="erreur" style={{ margin: '40px auto', maxWidth: 500 }}>Impossible de contacter le serveur : {erreur}</div>
  }
  if (!stats) {
    return <p className="loading">Chargement…</p>
  }

  const t = stats.taches_par_statut

  const cartes = [
    { label: 'Projets',  val: stats.total_projets, color: '#4f7cff' },
    { label: 'Tâches',   val: stats.total_taches,  color: '#2ec4b6' },
    { label: 'En cours', val: t['en_cours'] || 0,  color: '#a78bfa' },
    { label: 'À faire',  val: t['à_faire']  || 0,  color: '#f4a261' },
  ]

  const barres = [
    { key: 'à_faire',  label: 'À faire',   color: '#64748b' },
    { key: 'en_cours', label: 'En cours',  color: '#a78bfa' },
    { key: 'terminé',  label: 'Terminées', color: '#2ec4b6' },
  ]

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">Vue d'ensemble de vos projets et tâches</p>

      {/* Chiffres clés */}
      <div className="stats-grid">
        {cartes.map(({ label, val, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-val" style={{ color }}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="dash-row">
        {/* Barres de progression */}
        <div className="card">
          <h3 className="card-title">Répartition des tâches</h3>
          {barres.map(({ key, label, color }) => {
            const pct = stats.total_taches > 0
              ? Math.round(((t[key] || 0) / stats.total_taches) * 100)
              : 0
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

        {/* Liste des projets récents */}
        <div className="card">
          <h3 className="card-title">Projets récents</h3>
          {projets.length === 0 ? (
            <p className="empty">Aucun projet</p>
          ) : (
            projets.slice(0, 5).map(p => (
              <div key={p.id} className="projet-row">
                <div>
                  <div className="projet-row-name">{p.nom}</div>
                  <div className="projet-row-meta">{p.nb_taches} tâches · {p.nb_terminees} terminées</div>
                </div>
                <span className={`badge badge-${p.statut}`}>{p.statut}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────
// PAGE PROJETS
// ─────────────────────────────────────────

const FORM_PROJET_VIDE = { nom: '', description: '', date_debut: '', date_fin_prevue: '', statut: 'actif' }

function Projets() {
  const [projets, setProjets] = useState([])
  const [filtre, setFiltre]   = useState('tous')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState(FORM_PROJET_VIDE)
  const [erreur, setErreur]   = useState(null)
  const [errLoad, setErrLoad] = useState(null)

  useEffect(() => {
    getProjets().then(setProjets).catch(e => setErrLoad(e.message))
  }, [])

  const projetsFiltres = filtre === 'tous'
    ? projets
    : projets.filter(p => p.statut === filtre)

  // Change le statut d'un projet directement depuis la liste
  async function changerStatutProjet(id, nouveauStatut) {
    const ancienStatut = projets.find(p => p.id === id)?.statut
    // Mise à jour optimiste : on change l'affichage avant la réponse du serveur
    setProjets(ps => ps.map(p => p.id === id ? { ...p, statut: nouveauStatut } : p))
    try {
      await updateProjet(id, { statut: nouveauStatut })
    } catch (e) {
      // En cas d'erreur, on remet l'ancien statut
      setProjets(ps => ps.map(p => p.id === id ? { ...p, statut: ancienStatut } : p))
      alert('Erreur lors de la mise à jour du statut : ' + e.message)
    }
  }

  async function creerProjet() {
    setErreur(null)
    try {
      const p = await createProjet(form)
      setProjets(ps => [p, ...ps])
      setShowForm(false)
      setForm(FORM_PROJET_VIDE)
    } catch (e) {
      setErreur(e.message)
    }
  }

  async function supprimerProjet(id) {
    if (!confirm('Supprimer ce projet et toutes ses tâches ?')) return
    try {
      await deleteProjet(id)
      setProjets(ps => ps.filter(p => p.id !== id))
    } catch (e) {
      alert('Erreur lors de la suppression : ' + e.message)
    }
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

      {/* Formulaire de création */}
      {showForm && (
        <div className="card form-card">
          {erreur && <div className="erreur">{erreur}</div>}
          <div className="form-group">
            <label>Nom *</label>
            <input
              value={form.nom}
              onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
              placeholder="Nom du projet"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description…"
            />
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
            <button className="btn btn-primary" onClick={creerProjet}>Créer le projet</button>
          </div>
        </div>
      )}

      {/* Filtres par statut */}
      <div className="filtres">
        {['tous', 'actif', 'en_pause', 'terminé'].map(s => (
          <button
            key={s}
            className={filtre === s ? 'filtre-btn actif' : 'filtre-btn'}
            onClick={() => setFiltre(s)}
          >
            {s === 'tous' ? 'Tous' : s}
          </button>
        ))}
        <span className="filtre-count">{projetsFiltres.length} résultat{projetsFiltres.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Liste des projets */}
      {projetsFiltres.length === 0 ? (
        <div className="empty">Aucun projet{filtre !== 'tous' ? ` avec le statut "${filtre}"` : ''}</div>
      ) : (
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
                  <button className="btn-delete" onClick={() => supprimerProjet(p.id)}>✕</button>
                </div>
                <h3 className="projet-card-title">{p.nom}</h3>
                {p.description && <p className="projet-card-desc">{p.description}</p>}
                <div className="projet-card-meta">
                  <span>📅 {p.date_fin_prevue}</span>
                  <span>{p.nb_taches} tâche{p.nb_taches !== 1 ? 's' : ''}</span>
                </div>
                {/* Barre de progression */}
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
      )}
    </div>
  )
}


// ─────────────────────────────────────────
// PAGE DÉTAIL PROJET — vue Kanban 3 colonnes
// ─────────────────────────────────────────

const STATUTS    = ['à_faire', 'en_cours', 'terminé']
const LABELS_COL = { 'à_faire': 'À faire', 'en_cours': 'En cours', 'terminé': 'Terminé' }

// Retourne le statut suivant dans le cycle
function statutSuivant(statut) {
  if (statut === 'à_faire')  return 'en_cours'
  if (statut === 'en_cours') return 'terminé'
  return 'à_faire'
}

// Retourne le libellé du bouton selon le statut actuel
function libelleBouton(statut) {
  if (statut === 'à_faire')  return '▶ Démarrer'
  if (statut === 'en_cours') return '✓ Terminer'
  return '↺ Rouvrir'
}

const FORM_TACHE_VIDE = { titre: '', description: '', membre_id: '', priorite: 'moyenne' }

function ProjetDetail() {
  const { id } = useParams()
  const [projet, setProjet]     = useState(null)
  const [taches, setTaches]     = useState([])
  const [membres, setMembres]   = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(FORM_TACHE_VIDE)
  const [erreur, setErreur]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [errLoad, setErrLoad]   = useState(null)
  const [editId, setEditId]     = useState(null)
  const [editForm, setEditForm] = useState({})

  useEffect(() => {
    Promise.all([getProjet(id), getTaches(id), getMembres()])
      .then(([p, ts, ms]) => {
        setProjet(p)
        setTaches(ts)
        setMembres(ms)
        setLoading(false)
      })
      .catch(e => {
        setErrLoad(e.message)
        setLoading(false)
      })
  }, [id])

  function ouvrirEdition(tache) {
    setEditId(tache.id)
    setEditForm({
      titre:       tache.titre,
      description: tache.description || '',
      membre_id:   String(tache.membre_id),
      priorite:    tache.priorite,
    })
  }

  async function sauvegarderEdition(tache) {
    try {
      const modifiee = await updateTache(tache.id, {
        ...editForm,
        membre_id: parseInt(editForm.membre_id),
      })
      setTaches(ts => ts.map(t => t.id === modifiee.id ? modifiee : t))
      setEditId(null)
    } catch (e) {
      setErreur(e.message)
    }
  }

  async function changerStatut(tache) {
    try {
      const modifiee = await updateTache(tache.id, { statut: statutSuivant(tache.statut) })
      setTaches(ts => ts.map(t => t.id === modifiee.id ? modifiee : t))
    } catch (e) {
      alert('Erreur lors du changement de statut : ' + e.message)
    }
  }

  async function supprimerTache(tid) {
    if (!confirm('Supprimer cette tâche ?')) return
    try {
      await deleteTache(tid)
      setTaches(ts => ts.filter(t => t.id !== tid))
    } catch (e) {
      alert('Erreur lors de la suppression : ' + e.message)
    }
  }

  async function creerTache() {
    setErreur(null)
    try {
      const nouvelle = await createTache(id, {
        ...form,
        membre_id: parseInt(form.membre_id),
      })
      setTaches(ts => [...ts, nouvelle])
      setShowForm(false)
      setForm(FORM_TACHE_VIDE)
    } catch (e) {
      setErreur(e.message)
    }
  }

  if (loading) return <p className="loading">Chargement du projet…</p>
  if (errLoad) return <div className="erreur" style={{ margin: '40px auto', maxWidth: 500 }}>Impossible de charger le projet : {errLoad}</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><Link to="/projets">Projets</Link> › {projet?.nom}</div>
          <h1 className="page-title">{projet?.nom}</h1>
          {projet && (
            <span className={`badge badge-${projet.statut}`} style={{ marginTop: 6, display: 'inline-flex' }}>
              {projet.statut}
            </span>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Annuler' : '+ Nouvelle tâche'}
        </button>
      </div>

      {/* Formulaire de création de tâche */}
      {showForm && (
        <div className="card form-card">
          {erreur && <div className="erreur">{erreur}</div>}
          <div className="form-group">
            <label>Titre *</label>
            <input
              value={form.titre}
              onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              placeholder="Titre de la tâche"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description…"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Assigné à *</label>
              <select value={form.membre_id} onChange={e => setForm(f => ({ ...f, membre_id: e.target.value }))}>
                <option value="">Choisir un membre</option>
                {membres.map(m => (
                  <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                ))}
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

      {/* Kanban : 3 colonnes */}
      <div className="kanban">
        {STATUTS.map(statut => {
          const tachesColonne = taches.filter(t => t.statut === statut)
          return (
            <div key={statut} className={`kanban-col kanban-${statut.replace('_', '-')}`}>
              <div className="kanban-header">
                <span>{LABELS_COL[statut]}</span>
                <span className="kanban-count">{tachesColonne.length}</span>
              </div>

              {tachesColonne.length === 0 && (
                <div className="kanban-empty">Aucune tâche</div>
              )}

              {tachesColonne.map(t => (
                <div key={t.id} className="tache-card">
                  {/* Mode édition */}
                  {editId === t.id ? (
                    <div className="tache-edit">
                      <input
                        value={editForm.titre}
                        onChange={e => setEditForm(f => ({ ...f, titre: e.target.value }))}
                        placeholder="Titre"
                      />
                      <textarea
                        value={editForm.description}
                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Description…"
                      />
                      <select
                        value={editForm.membre_id}
                        onChange={e => setEditForm(f => ({ ...f, membre_id: e.target.value }))}
                      >
                        {membres.map(m => (
                          <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                        ))}
                      </select>
                      <select
                        value={editForm.priorite}
                        onChange={e => setEditForm(f => ({ ...f, priorite: e.target.value }))}
                      >
                        <option value="basse">Basse</option>
                        <option value="moyenne">Moyenne</option>
                        <option value="haute">Haute</option>
                      </select>
                      {erreur && <div className="erreur">{erreur}</div>}
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => sauvegarderEdition(t)}>Sauvegarder</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>Annuler</button>
                      </div>
                    </div>
                  ) : (
                    /* Mode affichage */
                    <>
                      <div className="tache-top">
                        <span className={`badge badge-${t.priorite}`}>{t.priorite}</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-delete" title="Modifier" onClick={() => ouvrirEdition(t)}>✎</button>
                          <button className="btn-delete" title="Supprimer" onClick={() => supprimerTache(t.id)}>✕</button>
                        </div>
                      </div>
                      <div className="tache-titre">{t.titre}</div>
                      {t.description && <div className="tache-desc">{t.description}</div>}
                      <div className="tache-footer">
                        <span className="tache-membre">👤 {t.membre_nom || '—'}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => changerStatut(t)}>
                          {libelleBouton(t.statut)}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ─────────────────────────────────────────
// PAGE MEMBRES
// ─────────────────────────────────────────

const FORM_MEMBRE_VIDE = { nom: '', prenom: '', email: '', role: '' }

function Membres() {
  const [membres, setMembres]   = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(FORM_MEMBRE_VIDE)
  const [erreur, setErreur]     = useState(null)
  const [errLoad, setErrLoad]   = useState(null)
  const [membreSelectionne, setMembreSelectionne] = useState(null)
  const [detail, setDetail]     = useState(null)

  useEffect(() => {
    getMembres().then(setMembres).catch(e => setErrLoad(e.message))
  }, [])

  async function creerMembre() {
    setErreur(null)
    try {
      const m = await createMembre(form)
      setMembres(ms => [...ms, m])
      setShowForm(false)
      setForm(FORM_MEMBRE_VIDE)
    } catch (e) {
      setErreur(e.message)
    }
  }

  async function voirDetail(m) {
    setMembreSelectionne(m)
    setDetail(null)
    try {
      const d = await getMembre(m.id)
      setDetail(d)
    } catch (e) {
      setDetail({ taches_en_cours: [] })
    }
  }

  function fermerModal() {
    setMembreSelectionne(null)
    setDetail(null)
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

      {/* Formulaire de création */}
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
            <button className="btn btn-primary" onClick={creerMembre}>Créer le membre</button>
          </div>
        </div>
      )}

      {errLoad && <div className="erreur">Impossible de charger les membres : {errLoad}</div>}
      {membres.length === 0 && !errLoad && (
        <div className="empty">Aucun membre. Ajoutez votre premier membre !</div>
      )}

      {/* Grille des membres — clic pour voir les tâches en cours */}
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

      {/* Modal : tâches en cours du membre sélectionné */}
      {membreSelectionne && (
        <div className="modal-overlay" onClick={fermerModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{membreSelectionne.prenom} {membreSelectionne.nom}</h2>
            <p style={{ color: 'var(--text2)', marginBottom: 16 }}>
              {membreSelectionne.role} · {membreSelectionne.email}
            </p>
            <h3 style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 12 }}>Tâches en cours</h3>

            {!detail ? (
              <p className="loading">Chargement…</p>
            ) : detail.taches_en_cours.length === 0 ? (
              <p className="empty">Aucune tâche en cours</p>
            ) : (
              detail.taches_en_cours.map(t => (
                <div key={t.id} className="tache-row-membre">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{t.titre}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {t.projet_nom || `Projet #${t.projet_id}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className={`badge badge-${t.statut}`}>{t.statut}</span>
                    <span className={`badge badge-${t.priorite}`}>{t.priorite}</span>
                  </div>
                </div>
              ))
            )}

            <div style={{ textAlign: 'right', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={fermerModal}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────
// PIED DE PAGE & APPLICATION PRINCIPALE
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
