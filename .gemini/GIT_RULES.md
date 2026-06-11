# Rappel du Workflow Git

Chaque matin : Vous partez tous de la branche dev mise à jour.
```bash
git checkout dev
git pull origin dev
```

Démarrage tâche : Vous créez votre branche dédiée :
```bash
git checkout -b feat/nom-de-votre-tache
```

Fin de tâche : Vous poussez votre branche et ouvrez une Pull Request (PR) vers dev.
```bash
git push -u origin feat/nom-de-votre-tache
```

Règle d'or : Un autre membre de l'équipe doit valider la PR avant le merge.

Important : Ne touchez jamais à main (réservée à la production) et ne faites jamais de push direct sur dev.
