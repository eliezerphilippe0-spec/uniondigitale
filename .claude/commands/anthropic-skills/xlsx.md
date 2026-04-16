# Tableaux de bord et données Excel (XLSX)

Skill spécialisé pour lire, analyser et créer des fichiers Excel (.xlsx) avec tableaux de bord et visualisations de données.

## Capacités

### Lecture de fichiers Excel
- Extraction et analyse des données
- Résumé statistique des colonnes
- Identification des tendances et anomalies
- Interprétation des tableaux croisés dynamiques

### Création de tableaux de bord
- Structuration des données en feuilles organisées
- Formules et calculs automatisés
- Mise en forme conditionnelle
- Graphiques et visualisations intégrées

### Analyses disponibles
- Tableaux de bord KPIs
- Rapports financiers
- Suivi de campagnes marketing
- Analyses de performance

## Utilisation

```python
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.chart import BarChart, Reference

# Créer un nouveau workbook
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Dashboard"

# Ajouter des données et formules
ws['A1'] = "Indicateur"
ws['B1'] = "Valeur"

# Sauvegarder
wb.save('tableau_de_bord.xlsx')
```

Fournis le fichier Excel ou décris les données et le tableau de bord à créer.
