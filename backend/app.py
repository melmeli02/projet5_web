from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
from datetime import date

app = Flask(__name__)
CORS(app)

app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "postgresql://admin:secret@localhost:5432/taskmanager"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# ──────────────────────────────────────────────
#  MODÈLES
# ──────────────────────────────────────────────

STATUTS_TACHE = ("à_faire", "en_cours", "terminé")
STATUTS_PROJET = ("actif", "en_pause", "terminé")
PRIORITES = ("basse", "moyenne", "haute")


class Membre(db.Model):
    __tablename__ = "membres"
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(100), nullable=False)
    prenom = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    role = db.Column(db.String(100), nullable=False)
    taches = db.relationship("Tache", backref="membre", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "nom": self.nom,
            "prenom": self.prenom,
            "email": self.email,
            "role": self.role,
        }


class Projet(db.Model):
    __tablename__ = "projets"
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    date_debut = db.Column(db.Date, nullable=False)
    date_fin_prevue = db.Column(db.Date, nullable=False)
    statut = db.Column(db.String(20), nullable=False, default="actif")
    taches = db.relationship(
        "Tache", backref="projet", lazy=True, cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "nom": self.nom,
            "description": self.description,
            "date_debut": str(self.date_debut),
            "date_fin_prevue": str(self.date_fin_prevue),
            "statut": self.statut,
            "nb_taches": len(self.taches),
            "nb_terminees": sum(1 for t in self.taches if t.statut == "terminé"),
        }


class Tache(db.Model):
    __tablename__ = "taches"
    id = db.Column(db.Integer, primary_key=True)
    projet_id = db.Column(
        db.Integer, db.ForeignKey("projets.id", ondelete="CASCADE"), nullable=False
    )
    membre_id = db.Column(
        db.Integer, db.ForeignKey("membres.id"), nullable=False
    )
    titre = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    statut = db.Column(db.String(20), nullable=False, default="à_faire")
    priorite = db.Column(db.String(10), nullable=False, default="moyenne")
    date_creation = db.Column(db.Date, nullable=False, default=date.today)

    def to_dict(self):
        return {
            "id": self.id,
            "projet_id": self.projet_id,
            "projet_nom": self.projet.nom if self.projet else None,
            "membre_id": self.membre_id,
            "membre_nom": f"{self.membre.prenom} {self.membre.nom}" if self.membre else None,
            "titre": self.titre,
            "description": self.description,
            "statut": self.statut,
            "priorite": self.priorite,
            "date_creation": str(self.date_creation),
        }


# ──────────────────────────────────────────────
#  HELPERS
# ──────────────────────────────────────────────

def err(msg, code=400):
    return jsonify({"error": msg}), code


# ──────────────────────────────────────────────
#  ROUTES MEMBRES
# ──────────────────────────────────────────────

@app.route("/membres", methods=["GET"])
def get_membres():
    membres = Membre.query.all()
    return jsonify([m.to_dict() for m in membres])


@app.route("/membres", methods=["POST"])
def create_membre():
    data = request.get_json()
    if not data:
        return err("Corps JSON manquant")
    for field in ("nom", "prenom", "email", "role"):
        if not data.get(field):
            return err(f"Champ obligatoire manquant : {field}")
    if Membre.query.filter_by(email=data["email"]).first():
        return err("Email déjà utilisé")
    membre = Membre(
        nom=data["nom"],
        prenom=data["prenom"],
        email=data["email"],
        role=data["role"],
    )
    db.session.add(membre)
    db.session.commit()
    return jsonify(membre.to_dict()), 201


@app.route("/membres/<int:id>", methods=["GET"])
def get_membre(id):
    m = db.session.get(Membre, id)
    if not m:
        return err("Membre introuvable", 404)
    taches_en_cours = [
        t.to_dict() for t in m.taches if t.statut != "terminé"
    ]
    data = m.to_dict()
    data["taches_en_cours"] = taches_en_cours
    return jsonify(data)


# ──────────────────────────────────────────────
#  ROUTES PROJETS
# ──────────────────────────────────────────────

@app.route("/projets", methods=["GET"])
def get_projets():
    projets = Projet.query.all()
    return jsonify([p.to_dict() for p in projets])


@app.route("/projets", methods=["POST"])
def create_projet():
    data = request.get_json()
    if not data:
        return err("Corps JSON manquant")
    for field in ("nom", "date_debut", "date_fin_prevue"):
        if not data.get(field):
            return err(f"Champ obligatoire manquant : {field}")
    statut = data.get("statut", "actif")
    if statut not in STATUTS_PROJET:
        return err(f"Statut invalide. Valeurs autorisées : {STATUTS_PROJET}")
    try:
        d_debut = date.fromisoformat(data["date_debut"])
        d_fin = date.fromisoformat(data["date_fin_prevue"])
    except ValueError:
        return err("Format de date invalide (attendu : YYYY-MM-DD)")
    projet = Projet(
        nom=data["nom"],
        description=data.get("description", ""),
        date_debut=d_debut,
        date_fin_prevue=d_fin,
        statut=statut,
    )
    db.session.add(projet)
    db.session.commit()
    return jsonify(projet.to_dict()), 201


@app.route("/projets/<int:id>", methods=["GET"])
def get_projet(id):
    p = db.session.get(Projet, id)
    if not p:
        return err("Projet introuvable", 404)
    return jsonify(p.to_dict())


@app.route("/projets/<int:id>", methods=["PUT"])
def update_projet(id):
    p = db.session.get(Projet, id)
    if not p:
        return err("Projet introuvable", 404)
    data = request.get_json()
    if not data:
        return err("Corps JSON manquant")
    if "statut" in data and data["statut"] not in STATUTS_PROJET:
        return err(f"Statut invalide. Valeurs autorisées : {STATUTS_PROJET}")
    if "nom" in data:
        p.nom = data["nom"]
    if "description" in data:
        p.description = data["description"]
    if "statut" in data:
        p.statut = data["statut"]
    if "date_debut" in data:
        try:
            p.date_debut = date.fromisoformat(data["date_debut"])
        except ValueError:
            return err("Format de date invalide")
    if "date_fin_prevue" in data:
        try:
            p.date_fin_prevue = date.fromisoformat(data["date_fin_prevue"])
        except ValueError:
            return err("Format de date invalide")
    db.session.commit()
    return jsonify(p.to_dict())


@app.route("/projets/<int:id>", methods=["DELETE"])
def delete_projet(id):
    p = db.session.get(Projet, id)
    if not p:
        return err("Projet introuvable", 404)
    db.session.delete(p)
    db.session.commit()
    return jsonify({"message": "Projet supprimé"}), 200


# ──────────────────────────────────────────────
#  ROUTES TÂCHES
# ──────────────────────────────────────────────

@app.route("/projets/<int:projet_id>/taches", methods=["GET"])
def get_taches(projet_id):
    p = db.session.get(Projet, projet_id)
    if not p:
        return err("Projet introuvable", 404)
    statut_filter = request.args.get("statut")
    query = Tache.query.filter_by(projet_id=projet_id)
    if statut_filter:
        if statut_filter not in STATUTS_TACHE:
            return err(f"Statut invalide. Valeurs autorisées : {STATUTS_TACHE}")
        query = query.filter_by(statut=statut_filter)
    return jsonify([t.to_dict() for t in query.all()])


@app.route("/projets/<int:projet_id>/taches", methods=["POST"])
def create_tache(projet_id):
    p = db.session.get(Projet, projet_id)
    if not p:
        return err("Projet introuvable", 404)
    data = request.get_json()
    if not data:
        return err("Corps JSON manquant")
    for field in ("titre", "membre_id"):
        if not data.get(field):
            return err(f"Champ obligatoire manquant : {field}")
    if not db.session.get(Membre, data["membre_id"]):
        return err("Membre introuvable", 404)
    statut = data.get("statut", "à_faire")
    if statut not in STATUTS_TACHE:
        return err(f"Statut invalide. Valeurs autorisées : {STATUTS_TACHE}")
    priorite = data.get("priorite", "moyenne")
    if priorite not in PRIORITES:
        return err(f"Priorité invalide. Valeurs autorisées : {PRIORITES}")
    tache = Tache(
        projet_id=projet_id,
        membre_id=data["membre_id"],
        titre=data["titre"],
        description=data.get("description", ""),
        statut=statut,
        priorite=priorite,
    )
    db.session.add(tache)
    db.session.commit()
    return jsonify(tache.to_dict()), 201


@app.route("/taches/<int:id>", methods=["PUT"])
def update_tache(id):
    t = db.session.get(Tache, id)
    if not t:
        return err("Tâche introuvable", 404)
    data = request.get_json()
    if "statut" in data and data["statut"] not in STATUTS_TACHE:
        return err(f"Statut invalide. Valeurs autorisées : {STATUTS_TACHE}")
    if "priorite" in data and data["priorite"] not in PRIORITES:
        return err(f"Priorité invalide. Valeurs autorisées : {PRIORITES}")
    if "membre_id" in data:
        if not db.session.get(Membre, data["membre_id"]):
            return err("Membre introuvable", 404)
        t.membre_id = data["membre_id"]
    for field in ("titre", "description", "statut", "priorite"):
        if field in data:
            setattr(t, field, data[field])
    db.session.commit()
    return jsonify(t.to_dict())


@app.route("/taches/<int:id>", methods=["DELETE"])
def delete_tache(id):
    t = db.session.get(Tache, id)
    if not t:
        return err("Tâche introuvable", 404)
    db.session.delete(t)
    db.session.commit()
    return jsonify({"message": "Tâche supprimée"}), 200


# ──────────────────────────────────────────────
#  TABLEAU DE BORD
# ──────────────────────────────────────────────

@app.route("/dashboard", methods=["GET"])
def dashboard():
    total_projets = Projet.query.count()
    total_taches = Tache.query.count()
    par_statut = {s: Tache.query.filter_by(statut=s).count() for s in STATUTS_TACHE}
    return jsonify({
        "total_projets": total_projets,
        "total_taches": total_taches,
        "taches_par_statut": par_statut,
    })


# ──────────────────────────────────────────────
#  LANCEMENT
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import time
    with app.app_context():
        for i in range(10):
            try:
                db.create_all()
                print("Base de données prête !")
                break
            except Exception as e:
                print(f"Attente base de données... ({i+1}/10)")
                time.sleep(3)
    app.run(host="0.0.0.0", port=5000, debug=True)
