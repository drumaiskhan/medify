export interface SampleChapterContent {
  id: string;
  title: string;
  moduleCode: string;
  readTime: string;
  curriculumRef: string;
  blockName: string;
  sections: {
    id: string;
    heading: string;
    content: string[];
  }[];
  table: {
    title: string;
    caption: string;
    headers: string[];
    rows: string[][];
  };
  diagram: {
    title: string;
    badge: string;
    description: string;
    steps: { step: string; label: string; detail: string }[];
  };
  highYieldPearls: string[];
}

export const SAMPLE_CHAPTER_CONTENT: SampleChapterContent = {
  id: 'chap-d1-1',
  title: 'Brainstem & Cranial Nerve Nuclei',
  moduleCode: 'KMU-MBBS-Y2-BLKD-ANAT01',
  readTime: '22 min read',
  curriculumRef: 'KMU MBBS Modular Syllabus',
  blockName: 'Block D (Neuroscience I & II)',
  sections: [
    {
      id: 'sec-overview',
      heading: '1. Functional Organization of Brainstem Nuclei',
      content: [
        'The brainstem (midbrain, pons, and medulla oblongata) houses vital reflex centers and the cranial nerve nuclei responsible for sensory and motor innervation of the head, neck, and visceral structures.',
        'During embryological development, the neural tube opens like a book at the level of the fourth ventricle. This displaces motor nuclei medially and sensory nuclei laterally, separated by the sulcus limitans.',
        'Understanding this medial-to-lateral spatial layout is clinically paramount for localizing stroke syndromes (e.g., medial medullary syndrome vs. lateral medullary syndrome of Wallenberg).'
      ]
    },
    {
      id: 'sec-columns',
      heading: '2. Functional Nuclear Columns of the Cranial Nerves',
      content: [
        'Cranial nerve nuclei are organized into distinct longitudinal columns based on their embryonic tissue origin and physiological modality.',
        'Somatic Efferent (SE / GSE): Located most medially adjacent to the midline. Innervates skeletal muscles derived from somites (CN III, IV, VI, XII).',
        'Special Visceral Efferent (SVE / Branchial Motor): Located ventrolateral to the somatic efferent column. Innervates muscles derived from pharyngeal arches (CN V3, VII, IX, X, XI).',
        'General Visceral Efferent (GVE / Parasympathetic): Autonomic preganglionic parasympathetic outputs (Edinger-Westphal [III], superior salivatory [VII], inferior salivatory [IX], dorsal motor nucleus of vagus [X]).'
      ]
    },
    {
      id: 'sec-clinical',
      heading: '3. Classical Brainstem Vascular Syndromes (KMU High-Yield)',
      content: [
        'Weber Syndrome (Superior Alternating Hemiplegia): Occlusion of paramedian branches of the posterior cerebral artery (PCA) damaging the crus cerebri and exiting CN III fibers. Manifests as ipsilateral oculomotor palsy with contralateral spastic hemiplegia.',
        'Wallenberg Syndrome (Lateral Medullary Infarction): Occlusion of the Posterior Inferior Cerebellar Artery (PICA) or vertebral artery. Characterized by ipsilateral loss of pain/temperature on the face (Spinal Trigeminal nucleus), contralateral loss of pain/temperature on the body (Spinothalamic tract), Horner syndrome, dysphagia, and ataxia.',
        'Millard-Gubler Syndrome: Ventral pontine stroke affecting the corticospinal tract and exiting fibers of CN VI and CN VII, resulting in ipsilateral facial weakness, internal strabismus, and contralateral hemiparesis.'
      ]
    }
  ],
  table: {
    title: 'Summary Table: Cranial Nerve Nuclei & Functional Modalities',
    caption: 'Essential reference for KMU Block D professional examinations',
    headers: ['Cranial Nerve', 'Primary Nucleus', 'Brainstem Level', 'Functional Modality', 'Key Clinical Test'],
    rows: [
      ['CN III (Oculomotor)', 'Oculomotor + Edinger-Westphal', 'Midbrain (Superior Colliculus)', 'GSE (Eye muscles) & GVE (Pupil constrictor)', 'Direct & consensual pupillary light reflex'],
      ['CN IV (Trochlear)', 'Trochlear Nucleus', 'Midbrain (Inferior Colliculus)', 'GSE (Superior Oblique muscle)', 'Head tilt test & downward inward gaze'],
      ['CN V (Trigeminal)', 'Main Sensory, Spinal, Mesencephalic, Motor', 'Pons (Extending to Cervical Cord)', 'GSA (Facial sensation) & SVE (Mastication)', 'Corneal reflex & jaw jerk reflex'],
      ['CN VI (Abducens)', 'Abducens Nucleus', 'Pons (Facial Colliculus)', 'GSE (Lateral Rectus muscle)', 'Lateral horizontal conjugate gaze'],
      ['CN VII (Facial)', 'Facial Motor, Superior Salivatory, Solitarius', 'Pons (Cerebellopontine Angle)', 'SVE (Facial muscles), GVE (Salivation/Lacrimation), SVA (Taste)', 'Forehead wrinkling & taste anterior 2/3 tongue'],
      ['CN IX (Glossopharyngeal)', 'Nucleus Ambiguus, Inferior Salivatory, Solitarius', 'Medulla (Post-olivary Sulcus)', 'SVE, GVE, GVA, SVA (Taste posterior 1/3 tongue)', 'Gag reflex (Afferent limb)'],
      ['CN X (Vagus)', 'Nucleus Ambiguus, Dorsal Motor, Solitarius', 'Medulla (Post-olivary Sulcus)', 'SVE, GVE (Thoracoabdominal viscera), GVA, SVA', 'Uvula deviation (Points away from lesion)'],
      ['CN XII (Hypoglossal)', 'Hypoglossal Nucleus', 'Medulla (Pre-olivary Sulcus)', 'GSE (Intrinsic & extrinsic tongue muscles)', 'Tongue protrusion (Protrudes toward lesion)']
    ]
  },
  diagram: {
    title: 'Anatomical Pathways: Medial vs. Lateral Brainstem Cross-Section',
    badge: 'Anatomical Schematic',
    description: 'Diagrammatic representation of the rule of 4s in brainstem vascular localization (Medial 4 Ms vs Lateral 4 Ss).',
    steps: [
      { step: '01', label: 'Motor Pathway (Medial)', detail: 'Corticospinal tract situated anteriorly near midline; lesions cause contralateral body weakness.' },
      { step: '02', label: 'Medial Lemniscus (Medial)', detail: 'Carries vibration & proprioception; lesions cause contralateral sensory loss.' },
      { step: '03', label: 'Motor Cranial Nerves (Medial)', detail: 'CN III, IV, VI, XII exit paramedianly (all factors of 12 except 1 & 2).' },
      { step: '04', label: 'Spinothalamic Tract (Lateral)', detail: 'Pain and temperature sensations; lesions produce contralateral body analgesia.' },
      { step: '05', label: 'Spinal Trigeminal Nucleus (Lateral)', detail: 'Pain/temperature from ipsilateral face; classic hallmark of PICA occlusion.' }
    ]
  },
  highYieldPearls: [
    'Rule of 4s: 4 structures in the midline start with M (Motor pathway, Medial lemniscus, Medial longitudinal fasciculus, Motor cranial nuclei 3, 4, 6, 12).',
    'Rule of 4s: 4 structures in the lateral zone start with S (Spinothalamic tract, Spinocerebellar tract, Sympathetic fibers, Sensory trigeminal nucleus).',
    'Cranial nerves that divide into 12 are medial: CN 3, CN 4, CN 6, and CN 12.',
    'A lower motor neuron (LMN) facial nerve lesion paralyzes the entire ipsilateral half of the face including the forehead, whereas an upper motor neuron (UMN) lesion spares the forehead due to bilateral cortical innervation.'
  ]
};
