# TaskFlow — Gestionnaire de Projets & Tâches

Projet 5 — Module Web Services ESME (2D 2DG) — Lionel OWONO

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Backend | Python 3 + Flask |
| ORM | SQLAlchemy |
| Base de données | PostgreSQL 15 |
| Frontend | React 18 + Vite |
| Conteneur | Docker + docker-compose |

## Lancement (une seule commande)

```bash
docker-compose up --build
```

L'application sera disponible sur :
- **Frontend** : http://localhost:5173
- **API Backend** : http://localhost:5000

## Architecture

```
Frontend React (port 5173)
    ↓ fetch() HTTP/JSON
API Flask (port 5000)
    ↓ SQLAlchemy ORM
PostgreSQL (port 5432)
```

## API REST — Endpoints

### Membres
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /membres | Lister tous les membres |
| POST | /membres | Créer un membre |
| GET | /membres/:id | Détail + tâches en cours |

### Projets
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /projets | Lister tous les projets |
| POST | /projets | Créer un projet |
| PUT | /projets/:id | Modifier un projet |
| DELETE | /projets/:id | Supprimer (cascade tâches) |

### Tâches
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /projets/:id/taches | Tâches d'un projet (filtre ?statut=) |
| POST | /projets/:id/taches | Créer une tâche |
| PUT | /taches/:id | Modifier / changer statut |
| DELETE | /taches/:id | Supprimer une tâche |

### Dashboard
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /dashboard | Statistiques globales |

## Règles métier

- Statuts tâche : `à_faire`, `en_cours`, `terminé`
- Statuts projet : `actif`, `en_pause`, `terminé`
- Priorités : `basse`, `moyenne`, `haute`
- Suppression projet → suppression en cascade des tâches
- Toute valeur non autorisée est rejetée par l'API (HTTP 400)
