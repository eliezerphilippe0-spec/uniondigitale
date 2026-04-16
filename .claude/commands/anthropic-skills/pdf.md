# Extraction et création de PDFs

Skill spécialisé pour lire, extraire du contenu et créer des fichiers PDF professionnels.

## Capacités

### Lecture et extraction de PDFs
- Extraction du texte complet
- Identification de la structure (titres, sections, tableaux)
- Extraction de données tabulaires
- Résumé et analyse du contenu
- Recherche d'informations spécifiques

### Création de PDFs
- Génération de documents professionnels
- Rapports structurés avec mise en forme
- Intégration de tableaux et graphiques
- Entêtes, pieds de page et numérotation
- Insertion d'images et logos

## Outils disponibles

```python
# Lecture avec PyPDF2
import PyPDF2
with open('document.pdf', 'rb') as f:
    reader = PyPDF2.PdfReader(f)
    text = reader.pages[0].extract_text()

# Création avec reportlab
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

c = canvas.Canvas('rapport.pdf', pagesize=A4)
c.setFont('Helvetica-Bold', 16)
c.drawString(100, 750, "Titre du rapport")
c.save()

# Extraction avancée avec pdfplumber
import pdfplumber
with pdfplumber.open('document.pdf') as pdf:
    for page in pdf.pages:
        print(page.extract_text())
        tables = page.extract_tables()
```

Fournis le fichier PDF à analyser ou décris le document PDF à créer.
