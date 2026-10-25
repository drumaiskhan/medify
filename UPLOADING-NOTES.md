# Uploading notes with images (Admin guide)

## 1. Prepare the Word file (one .docx per subject)

* **Headings:** *Heading 1* = topic/chapter, *Heading 2* and *Heading 3* = sub-topics. Heading 4 and lower are not kept. These headings build the outline students see.
* **Pictures:** Insert → Pictures, then set *Wrap Text → In Line with Text*. PNG or JPG, at least about 1200 px wide for diagrams.
* **Not supported (they are dropped, and the admin page tells you how many):** text boxes, shapes, SmartArt, Word charts, grouped drawings, EMF/WMF pictures. Fix: select the drawing → Copy → *Paste Special → Picture (PNG)*, or take a screenshot.
* **Emphasis:** use bold, italic, headings and tables. Font colours, highlighter colour and table shading are not kept.
* Put captions in a normal paragraph under the picture.

## 2. Upload in the Admin site (Subject notes)

1. **Year:** click the year tab (2nd, 3rd or 4th Year MBBS).
2. **Module:** click the module card, e.g. *Renal Module*. The upload section opens directly below it. (**Add a module** creates a new one; type its name and the section opens.)
3. **Subject:** each module can hold several subjects (e.g. Anatomy, Physiology, Biochemistry). Click an existing subject, or **Add subject** and type its name. The upload controls appear once a subject is chosen.
4. Choose the `.docx` for that subject. Each picture is shrunk to at most 1400 px, converted to WebP and stored privately.
5. Check the preview. Fix anything in Word and upload again if needed.
6. **Save Notes.** *Published* is on by default, so the notes appear at once under that subject in the module for students who bought that year, and in your own admin student account (Dashboard → All Notes Library). Untick *Published* to keep that subject hidden from students; it still shows in your admin library marked *Draft*.
7. Optionally tick *Free Sample* so students without a subscription can read that subject's notes.

Each subject holds one set of notes. Uploading again into the same subject replaces its text. Repeat steps 3 to 7 for the module's other subjects. Existing modules that already have one note keep working: that note shows up as a subject with the module's name.

Modules in the starter curriculum:

* **2nd Year:** Neuroscience · Renal · GIT & Hepatobiliary · Endocrine & Reproduction
* **3rd Year:** Foundation II · Infection & Inflammation · Blood & Immunology · Multisystem · Cardiovascular & Respiratory
* **4th Year:** Neuroscience · GIT & Hepatobiliary · Renal · Endocrine & Reproduction · Otorhinolaryngology (M1) · Ophthalmology (M2)

Re-uploading a file replaces the text. Old image files stay on disk (harmless) and identical pictures are never stored twice.

## 3. Backups

Back up **both** the PostgreSQL database and the folder set in `UPLOAD_DIR` (it holds `note-images/` and the PDF books).

## 4. Who can see the images

Images are served only to approved students whose subscription for that year has not expired (and to free-sample readers and admins). They are not public files.
