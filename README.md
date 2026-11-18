# Carte de double isochrone

> **Identifiez la zone accessible depuis deux points de départ indépendants et analysez leur intersection géographique.**

---

## 1. Présentation générale et objectif

Une **isochrone** est une zone géographique délimitant l'ensemble des points pouvant être atteints depuis un lieu donné en un temps maximal prédéfini, selon un mode de transport déterminé (voiture, vélo ou marche à pied).

L’application **Double Isochrone** est un outil cartographique interactif professionnel conçu pour les chargés de mission territoriale, collectivités, agences d'urbanisme, bureaux d'études et entreprises. Elle permet de :

1. Définir deux points de départ totalement indépendants (**Point A** et **Point B**) par recherche d'adresse, clic sur la carte ou déplacement de marqueurs ;
2. Associer à chaque point son propre profil de mobilité (Voiture, Vélo, Marche) et sa propre durée de trajet (de 5 à 120 minutes) ;
3. Interroger l'API d'OpenRouteService pour calculer les deux isochrones fondées sur le **réseau réel des voies de circulation** (routes, pistes cyclables, chemins piétons), sans jamais recourir à de simples cercles à vol d'oiseau ;
4. Calculer précisément l'**intersection géographique** (zone commune) des deux isochrones à l'aide de **Turf.js** ;
5. Afficher les superficies en kilomètres carrés ($km^2$) et les pourcentages de recouvrement mutuel ;
6. Exporter l'intégralité des résultats au format **GeoJSON** pour une exploitation immédiate dans des logiciels SIG comme **QGIS**.

L’application est **100 % statique** (HTML5, CSS3, JavaScript moderne) et optimisée pour être hébergée directement sur **GitHub Pages**.

---

## 2. Technologies employées

L’application a été construite sans framework lourd ni étape de compilation (*no build step*), garantissant une pérennité maximale et un déploiement instantané :

- **HTML5 & CSS3** : Interface moderne, responsive (adaptée aux ordinateurs, tablettes et smartphones dès 320 px de large), respectueuse des critères d’accessibilité (WCAG / RGAA) ;
- **JavaScript moderne (ES6+)** : Architecture modulaire, asynchrone (`Promise.all`, `async/await`), gestion robuste des erreurs et des annulations de requêtes (`AbortController`) ;
- **Leaflet (v1.9.4)** : Bibliothèque cartographique légère, performante et personnalisée (panes d'ordonnancement des couches, icônes SVG customisées, infobulles) ;
- **OpenStreetMap** : Fonds de plan cartographiques ouverts et collaboratifs avec attribution intégrée ;
- **OpenRouteService (ORS)** : API de géocodage mondial (Pelias) et moteur d'isochrones s'appuyant sur le graphe routier d'OpenStreetMap ;
- **Turf.js (v6.5.0)** : Moteur d'analyse spatiale pour les calculs géodésiques d'intersection géométrique et de superficies ;
- **GeoJSON** : Standard ouvert de manipulation et d'interopérabilité des données vectorielles.

---

## 3. Arborescence du projet

Le projet respecte une organisation claire et immédiatement déployable :

```text
Double_Isochrone/
├── index.html            # Structure HTML principale de l'application
├── styles.css            # Feuille de style CSS complète et responsive
├── app.js                # Logique applicative, gestion Leaflet, ORS et Turf.js
├── config.js             # Fichier de configuration locale portant la clé API
├── config.example.js     # Modèle de configuration prêt à l'emploi
├── .gitignore            # Règles d'exclusion Git et explications de sécurité
└── README.md             # Guide complet d'installation, déploiement et SIG
```

---

## 4. Obtention et configuration de la clé API OpenRouteService

L’application nécessite une clé d'accès à l'API gratuite d'OpenRouteService.

### Étape 1 : Créer un compte OpenRouteService
1. Rendez-vous sur la plateforme officielle : [https://openrouteservice.org/dev/#/signup](https://openrouteservice.org/dev/#/signup).
2. Créez un compte gratuit (*Free Tier* offrant 2 000 requêtes de géocodage et 500 requêtes d'isochrones par jour).
3. Confirmez votre adresse email et connectez-vous sur votre tableau de bord (*Dashboard*).

### Étape 2 : Générer un jeton d'API (Token)
1. Dans l'onglet **Tokens**, cliquez sur **Request a token**.
2. Choisissez le type de jeton : **Standard / Free**.
3. Donnez un nom au jeton (ex. : `Double-Isochrone-Prototype`).
4. Copiez la clé alphanumérique générée (chaîne d'environ 60 caractères).

### Étape 3 : Configurer `config.js`
1. À la racine du dossier, assurez-vous d'avoir le fichier `config.js` (si vous partez de zéro, dupliquez `config.example.js` vers `config.js`).
2. Ouvrez `config.js` dans votre éditeur de code.
3. Remplacez `"VOTRE_CLE_OPENROUTESERVICE"` par votre véritable clé :

```javascript
window.APP_CONFIG = {
  ORS_API_KEY: "5b3ce3597851110001cf6248..."
};
```

---

## 5. Limites de sécurité d'une application statique sur GitHub Pages

> [!WARNING]
> **Avertissement impératif sur la confidentialité de la clé API :**
> 
> Dans une application entièrement statique hébergée côté client (comme sur GitHub Pages), **la clé API ne peut jamais être tenue secrète**. 
> Tout utilisateur consultant le code source, inspectant les requêtes réseau (onglet Réseau des outils de développement du navigateur) ou clonant le dépôt public peut voir cette clé.
>
> - **Usage adapté** : Ce projet convient parfaitement pour un prototype, une démonstration pédagogique, un outil interne ou un usage personnel à volumétrie modérée ;
> - **Recommandation** : Utilisez une clé dédiée exclusivement à ce projet, distincte de vos clés de production éventuelles ;
> - **Surveillance** : Surveillez la consommation de vos quotas sur votre console OpenRouteService ;
> - **Révocation** : Révoquez et régénérez votre clé en un clic depuis votre compte ORS si nécessaire ;
> - **Architecture de production sécurisée** : Pour un déploiement d'entreprise public à grande échelle, il conviendrait de relayer les appels par un micro-backend ou une fonction *serverless* (ex. Cloudflare Workers, Vercel Functions, AWS Lambda) agissant en tant que mandataire (*reverse proxy*), masquant la clé et appliquant un contrôle d'accès / limitation de débit (*rate-limiting*).

---

## 6. Test et exécution en local

L'application étant purement statique, vous pouvez l'exécuter localement de deux manières.

### Méthode A : Ouverture directe dans le navigateur
Double-cliquez simplement sur le fichier `index.html` ou glissez-le dans votre navigateur (Chrome, Firefox, Edge, Safari). L'ensemble des fonctionnalités est opérationnel.

### Méthode B : Via un serveur HTTP local léger
Pour simuler parfaitement les conditions réseau d'un hébergement web, lancez l'un des serveurs suivants depuis le dossier du projet :

- **Avec Python 3** :
  ```bash
  python -m http.server 8080
  ```
  Ouvrez ensuite : [http://localhost:8080](http://localhost:8080)

- **Avec l'extension VS Code "Live Server"** :
  Faites un clic droit sur `index.html` > **Open with Live Server**.

---

## 7. Déploiement étape par étape sur GitHub Pages

Suivez ce guide pas à pas pour publier votre application en ligne gratuitement avec **GitHub Pages**.

### Étape 1 : Créer le dépôt sur GitHub
1. Connectez-vous sur [GitHub.com](https://github.com).
2. Cliquez sur **New repository** (Nouveau dépôt).
3. Nommez le dépôt (par exemple : `Double_Isochrone`).
4. Choisissez la visibilité (Public ou Privé selon vos souhaits).
5. Ne cochez pas l'initialisation automatique d'un README si vos fichiers sont déjà prêts localement.
6. Cliquez sur **Create repository**.

### Étape 2 : Initialiser Git et pousser les fichiers en local

Ouvrez un terminal dans le dossier `Double_Isochrone` et exécutez les commandes suivantes :

```bash
# 1. Initialiser le dépôt local Git (si pas déjà fait)
git init

# 2. Configurer la branche principale sous le nom 'main'
git branch -M main

# 3. Lier votre dépôt distant GitHub (remplacez par votre identifiant)
git remote add origin https://github.com/VOTRE_NOM_UTILISATEUR/Double_Isochrone.git

# 4. Vérifier les fichiers avant ajout
git status

# 5. Ajouter les fichiers au suivi Git
# NOTE : Si vous souhaitez que le site GitHub Pages fonctionne immédiatement,
# config.js contenant votre clé doit être présent sur le dépôt.
git add index.html styles.css app.js config.js config.example.js .gitignore README.md

# 6. Effectuer le premier commit
git commit -m "feat: version initiale complète de l'application Double Isochrone"

# 7. Pousser le code vers GitHub
git push -u origin main
```

### Étape 3 : Activer GitHub Pages dans les paramètres du dépôt
1. Sur la page de votre dépôt GitHub, cliquez sur l'onglet **Settings** (Paramètres).
2. Dans le menu de gauche, descendez jusqu'à la section **Pages**.
3. Sous **Build and deployment** > **Source**, sélectionnez : **Deploy from a branch**.
4. Sous **Branch**, sélectionnez la branche `main` et le dossier `/ (root)`.
5. Cliquez sur **Save** (Enregistrer).

### Étape 4 : Récupérer et vérifier l'URL de votre application
1. Patientez 1 à 2 minutes pendant que l'action GitHub Pages finalise le déploiement.
2. Actualisez la page des paramètres Pages : l'URL publiée s'affiche en haut sous la forme :
   `https://VOTRE_NOM_UTILISATEUR.github.io/Double_Isochrone/`
3. Ouvrez ce lien dans votre navigateur pour tester votre application en ligne.

---

## 8. Guide d'utilisation de l'application

1. **Définir le Point A (Bleu)** :
   - Saisissez un lieu dans le champ *Rechercher une adresse (A)* (au moins 3 lettres) puis cliquez sur la suggestion de votre choix (sélection à la souris ou au clavier avec Flèche Bas / Entrée) ;
   - Ou cliquez sur **Sélectionner A sur la carte**, puis cliquez n'importe où sur la carte ;
   - Vous pouvez également faire glisser le marqueur bleu à tout moment pour affiner la position.
2. **Définir les paramètres du Point A** :
   - Choisissez le mode de transport : Voiture, Vélo ou Marche ;
   - Réglez la durée de trajet (entre 5 et 120 minutes) via le curseur ou la boîte numérique.
3. **Définir le Point B (Orange)** :
   - Répétez l'opération de manière totalement autonome pour le second point.
4. **Lancer le calcul** :
   - Cliquez sur le bouton principal **Calculer les zones accessibles** ;
   - L'indicateur d'activité affiche l'état d'avancement des requêtes exécutées en parallèle.
5. **Consulter les résultats** :
   - La carte ajuste automatiquement son cadrage pour afficher les deux zones et leur intersection ;
   - Le panneau de résultats indique pour chaque zone sa superficie exacte en $km^2$ ainsi que le pourcentage d'accessibilité partagé ;
   - Si les zones sont trop distantes, un message clair signale qu'aucun recoupement n'existe.
6. **Contrôler l'affichage** :
   - Utilisez les cases à cocher en haut à droite de la carte pour masquer ou afficher l'isochrone A, l'isochrone B ou l'intersection.

---

## 9. Exploitation des exports GeoJSON dans QGIS

L'application permet d'exporter 3 fichiers GeoJSON distincts :
- `isochrone-A.geojson` : Polygone d'accessibilité du point A ;
- `isochrone-B.geojson` : Polygone d'accessibilité du point B ;
- `intersection-isochrones.geojson` : Polygone représentant strictement la zone commune aux deux départs.

Chaque fichier contient des attributs complets (adresses de départ, coordonnées, durées, modes, superficies en $km^2$, pourcentages, horodatage ISO 8601 et attributions).

### Pour ouvrir et exploiter les données dans QGIS :
1. Lancez **QGIS** (version 3.x ou supérieure) ;
2. Glissez-déposez simplement les fichiers `.geojson` téléchargés dans le panneau des couches de QGIS (ou menu *Couche > Ajouter une couche > Ajouter une couche vecteur*) ;
3. Les géométries s'affichent instantanément dans le système de coordonnées de référence mondial standard **WGS 84 (EPSG:4326)** ;
4. Ouvrez la table d'attributs (clic droit sur la couche > *Ouvrir la table d'attributs*) pour inspecter les métadonnées territoriales calculées.

---

## 10. Diagnostic et résolution des anomalies (Console du navigateur)

Si une anomalie survient, ouvrez les outils de développement de votre navigateur :
- Raccourci : **F12** ou **Ctrl + Maj + I** (Windows/Linux), **Cmd + Option + I** (Mac) ;
- Consultez l'onglet **Console** et l'onglet **Réseau** (*Network*).

| Code / Symptôme | Cause probable | Solution |
| :--- | :--- | :--- |
| **Bannière jaune d'alerte** | `config.js` contient la clé par défaut ou une clé vide. | Ouvrez `config.js` et indiquez votre véritable clé ORS. |
| **Erreur HTTP 401 ou 403** | Clé API invalide, non activée ou mal recopiée. | Vérifiez votre clé sur le tableau de bord OpenRouteService. |
| **Erreur HTTP 429** | Quota journalier dépassé (500 isochrones/jour en compte gratuit). | Patientez jusqu'au renouvellement du quota ou utilisez un second compte. |
| **Erreur CORS / Réseau** | Problème de connexion ou pare-feu d'entreprise bloquant l'API ORS. | Vérifiez votre accès Internet ou testez depuis un réseau personnel. |
| **"Les paramètres ont été modifiés"** | Vous avez bougé un marqueur ou changé une durée après un calcul. | Cliquez simplement à nouveau sur **Calculer les zones accessibles**. |

---

## 11. Perspectives pour une future version sécurisée

Dans l'optique d'un produit commercial ou d'une application institutionnelle pérenne :
1. **Mise en place d'un proxy serveur (Backend ou Serverless)** : Une fonction Cloudflare Worker ou AWS Lambda reçoit la requête du client, injecte la clé API stockée de façon secrète dans les variables d'environnement du serveur, et retourne la réponse au navigateur.
2. **Gestion de quotas et limitation de fréquence** : Blocage des abus par adresse IP ou par session utilisateur.
3. **Mise en cache cartographique** : Mise en mémoire tampon (*caching*) des isochrones récurrentes pour réduire drastiquement la consommation de requêtes API.
4. **Prise en compte des transports en commun** : Intégration future d'API multimodales (GTFS / Navitia / SNCF / OpenTripPlanner).
