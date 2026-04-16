# Lecture et création de fichiers PowerPoint (PPTX)

Skill spécialisé pour lire, analyser et créer des fichiers PowerPoint (.pptx) en utilisant la bibliothèque python-pptx.

## Capacités

### Lecture de fichiers PPTX
- Extraction du contenu textuel de chaque slide
- Analyse de la structure et du plan
- Identification des éléments (images, graphiques, tableaux)
- Résumé du contenu de la présentation

### Création de fichiers PPTX
- Génération de présentations complètes slide par slide
- Mise en forme professionnelle
- Insertion de tableaux et listes structurées
- Application de thèmes et couleurs personnalisés

## Utilisation

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

# Créer une nouvelle présentation
prs = Presentation()

# Ajouter des slides avec contenu
slide_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "Titre de la slide"

# Sauvegarder
prs.save('presentation.pptx')
```

Fournis le fichier PPTX ou décris le contenu à créer pour commencer.
