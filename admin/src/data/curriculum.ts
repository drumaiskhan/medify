/**
 * MEDIFY Curriculum Data
 * Khyber Medical University (KMU) Modular Integrated MBBS Curriculum
 * 
 * Single source of truth for all years, blocks, subjects, chapters, and subscription plans.
 * Designed to be easily replaced by a database API in future iterations.
 */

export interface Chapter {
  id: string;
  title: string;
  readingTimeMinutes: number;
  isSampleAvailable?: boolean;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
  chapters: Chapter[];
}

export interface Block {
  id: string;
  name: string;
  code: string;
  yearId: string;
  description: string;
  subjectsCount: number;
  totalChaptersCount: number;
  subjects: Subject[];
}

export interface YearPackage {
  id: string;
  yearNumber: number;
  title: string;
  status: 'active' | 'coming soon';
  blocks: Block[];
}

export interface Plan {
  id: string;
  durationMonths: number;
  name: string;
  price: string;
  billingText: string;
  features: string[];
  recommended?: boolean;
}

// -------------------------------------------------------------
// SUBSCRIPTION PLANS (Standard across all active years)
// -------------------------------------------------------------
export const PLANS: Plan[] = [
  {
    id: 'quarterly',
    durationMonths: 3,
    name: 'Quarterly Access',
    price: 'PKR 1,000',
    billingText: 'One-time payment · 3 months of access',
    features: [
      'Full access to all blocks in selected year',
      'KMU modular objective alignment',
      'High-yield clinical tables & diagrams',
      'Continuous syllabus updates',
      'Mobile & desktop study reader'
    ]
  },
  {
    id: 'half-yearly',
    durationMonths: 6,
    name: 'Half-Yearly Access',
    price: 'PKR 2,000',
    billingText: 'One-time payment · 6 months of access',
    recommended: true,
    features: [
      'Full access to all blocks in selected year',
      'KMU modular objective alignment',
      'High-yield clinical tables & diagrams',
      'Continuous syllabus updates',
      'Mobile & desktop study reader',
      'Ideal for mid-term modular assessments'
    ]
  },
  {
    id: 'annual',
    durationMonths: 12,
    name: 'Annual Pass',
    price: 'PKR 3,500',
    billingText: 'One-time payment · 12 months (Best Value)',
    features: [
      'Full 12-month access to entire academic year',
      'Full coverage of all 3 modular blocks',
      'KMU modular objective alignment',
      'High-yield clinical tables & diagrams'
    ]
  }
];

// -------------------------------------------------------------
// CURRICULUM DATA: 5 YEARS (KMU MODULAR SYSTEM)
// -------------------------------------------------------------
export const YEARS: YearPackage[] = [
  {
    id: '1st-year',
    yearNumber: 1,
    title: '1st Year MBBS',
    status: 'coming soon',
    blocks: []
  },
  {
    id: '2nd-year',
    yearNumber: 2,
    title: '2nd Year MBBS',
    status: 'active',
    blocks: [
      {
        id: 'block-d',
        name: 'Block D (Neuroscience I & II)',
        code: 'BLOCK-D',
        yearId: '2nd-year',
        description: 'Neuroanatomy, Central & Peripheral Nervous System Physiology, and Neurochemical Signaling.',
        subjectsCount: 3,
        totalChaptersCount: 6,
        subjects: [
          {
            id: 'sub-d1',
            name: 'Anatomy & Neuroanatomy',
            code: 'ANAT-201',
            chapters: [
              { id: 'chap-d1-1', title: 'Brainstem & Cranial Nerve Nuclei', readingTimeMinutes: 22, isSampleAvailable: true },
              { id: 'chap-d1-2', title: 'Spinal Cord Tracts & Vascular Supply', readingTimeMinutes: 18 }
            ]
          },
          {
            id: 'sub-d2',
            name: 'Physiology of Nervous System',
            code: 'PHYS-201',
            chapters: [
              { id: 'chap-d2-1', title: 'Sensory & Motor Pathways Integration', readingTimeMinutes: 25 },
              { id: 'chap-d2-2', title: 'Cerebellar Coordination & Basal Ganglia', readingTimeMinutes: 20 }
            ]
          },
          {
            id: 'sub-d3',
            name: 'Neurochemistry & Biochemistry',
            code: 'BIO-201',
            chapters: [
              { id: 'chap-d3-1', title: 'Neurotransmitter Biosynthesis & Breakdown', readingTimeMinutes: 15 },
              { id: 'chap-d3-2', title: 'Cerebral Glucose & Ketone Body Metabolism', readingTimeMinutes: 14 }
            ]
          }
        ]
      },
      {
        id: 'block-e',
        name: 'Block E (GIT, Hepatobiliary & Renal)',
        code: 'BLOCK-E',
        yearId: '2nd-year',
        description: 'Gastrointestinal tract, liver, gallbladder, pancreas and renal system structure and function.',
        subjectsCount: 3,
        totalChaptersCount: 6,
        subjects: [
          {
            id: 'sub-e1',
            name: 'Anatomy & Histology of GIT & Renal',
            code: 'ANAT-202',
            chapters: [
              { id: 'chap-e1-1', title: 'Stomach, Duodenum & Peritoneal Relations', readingTimeMinutes: 20 },
              { id: 'chap-e1-2', title: 'Renal Microanatomy & Juxtaglomerular Apparatus', readingTimeMinutes: 17 }
            ]
          },
          {
            id: 'sub-e2',
            name: 'Physiology of Digestion & Excretion',
            code: 'PHYS-202',
            chapters: [
              { id: 'chap-e2-1', title: 'Gastric Acid Secretion, Motility & Bile', readingTimeMinutes: 24 },
              { id: 'chap-e2-2', title: 'Glomerular Filtration Rate & Tubular Transport', readingTimeMinutes: 26 }
            ]
          },
          {
            id: 'sub-e3',
            name: 'Clinical Biochemistry',
            code: 'BIO-202',
            chapters: [
              { id: 'chap-e3-1', title: 'Bilirubin Metabolism & Differential Diagnosis of Jaundice', readingTimeMinutes: 19 },
              { id: 'chap-e3-2', title: 'Renal Acid-Base & Buffer Dynamics', readingTimeMinutes: 21 }
            ]
          }
        ]
      },
      {
        id: 'block-f',
        name: 'Block F (Endocrine & Reproduction)',
        code: 'BLOCK-F',
        yearId: '2nd-year',
        description: 'Hypothalamic-pituitary axis, adrenal, thyroid, parathyroid, and male/female reproductive biology.',
        subjectsCount: 3,
        totalChaptersCount: 6,
        subjects: [
          {
            id: 'sub-f1',
            name: 'Anatomy & Embryology',
            code: 'ANAT-203',
            chapters: [
              { id: 'chap-f1-1', title: 'Pituitary, Thyroid & Adrenal Gross Morphology', readingTimeMinutes: 19 },
              { id: 'chap-f1-2', title: 'Development of Urogenital Ducts & External Genitalia', readingTimeMinutes: 22 }
            ]
          },
          {
            id: 'sub-f2',
            name: 'Endocrine & Reproductive Physiology',
            code: 'PHYS-203',
            chapters: [
              { id: 'chap-f2-1', title: 'Pituitary-Thyroid-Adrenal Feedback Loops', readingTimeMinutes: 21 },
              { id: 'chap-f2-2', title: 'Ovarian Cycle, Endometrial Phases & Spermatogenesis', readingTimeMinutes: 25 }
            ]
          },
          {
            id: 'sub-f3',
            name: 'Hormonal Biochemistry',
            code: 'BIO-203',
            chapters: [
              { id: 'chap-f3-1', title: 'Steroid Hormone Synthesis & Catabolism', readingTimeMinutes: 16 },
              { id: 'chap-f3-2', title: 'Calcium, Phosphate & Vitamin D Homeostasis', readingTimeMinutes: 18 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: '3rd-year',
    yearNumber: 3,
    title: '3rd Year MBBS',
    status: 'active',
    blocks: [
      {
        id: 'block-g',
        name: 'Block G (Foundation II, Infection & Inflammation)',
        code: 'BLOCK-G',
        yearId: '3rd-year',
        description: 'General Pathology of cell injury and inflammation, Antimicrobial Pharmacotherapy, and Forensic traumatology.',
        subjectsCount: 3,
        totalChaptersCount: 6,
        subjects: [
          {
            id: 'sub-g1',
            name: 'General Pathology',
            code: 'PATH-301',
            chapters: [
              { id: 'chap-g1-1', title: 'Cellular Adaptations & Mechanisms of Necrosis/Apoptosis', readingTimeMinutes: 20 },
              { id: 'chap-g1-2', title: 'Acute vs. Chronic Inflammation Mediators', readingTimeMinutes: 22 }
            ]
          },
          {
            id: 'sub-g2',
            name: 'General Pharmacology',
            code: 'PHARM-301',
            chapters: [
              { id: 'chap-g2-1', title: 'Pharmacokinetics: Absorption, Distribution & Clearance', readingTimeMinutes: 24 },
              { id: 'chap-g2-2', title: 'Autonomic Nervous System: Cholinergic & Adrenergic Agonists', readingTimeMinutes: 28 }
            ]
          },
          {
            id: 'sub-g3',
            name: 'Forensic Medicine & Toxicology',
            code: 'FOREN-301',
            chapters: [
              { id: 'chap-g3-1', title: 'Post-Mortem Changes & Rigor Mortis Time Estimates', readingTimeMinutes: 17 },
              { id: 'chap-g3-2', title: 'Mechanical Injuries & Wound Ballistics', readingTimeMinutes: 19 }
            ]
          }
        ]
      },
      {
        id: 'block-h',
        name: 'Block H (Blood & Immunology, Multimodule System)',
        code: 'BLOCK-H',
        yearId: '3rd-year',
        description: 'Hematopathology, Immunopathology, Anticoagulant Pharmacotherapy, and Infectious Disease Epidemiology.',
        subjectsCount: 3,
        totalChaptersCount: 6,
        subjects: [
          {
            id: 'sub-h1',
            name: 'Hematopathology & Immunology',
            code: 'PATH-302',
            chapters: [
              { id: 'chap-h1-1', title: 'Microcytic & Macrocytic Anemias Classification', readingTimeMinutes: 21 },
              { id: 'chap-h1-2', title: 'Hypersensitivity Reactions Types I-IV & Autoimmunity', readingTimeMinutes: 23 }
            ]
          },
          {
            id: 'sub-h2',
            name: 'Pharmacology of Blood & Immune System',
            code: 'PHARM-302',
            chapters: [
              { id: 'chap-h2-1', title: 'Heparin, Warfarin & Direct Oral Anticoagulants', readingTimeMinutes: 18 },
              { id: 'chap-h2-2', title: 'Corticosteroids & Targeted Immunosuppressants', readingTimeMinutes: 19 }
            ]
          },
          {
            id: 'sub-h3',
            name: 'Community Medicine',
            code: 'COMM-302',
            chapters: [
              { id: 'chap-h3-1', title: 'Epidemiology of Malaria & Dengue in Pakistan', readingTimeMinutes: 16 },
              { id: 'chap-h3-2', title: 'National EPI Vaccination Schedule & Cold Chain Management', readingTimeMinutes: 18 }
            ]
          }
        ]
      },
      {
        id: 'block-i',
        name: 'Block I (Cardiovascular, Respiratory)',
        code: 'BLOCK-I',
        yearId: '3rd-year',
        description: 'Cardiopulmonary Pathology, Cardiovascular/Respiratory Pharmacology, and Occupational Pulmonary Health.',
        subjectsCount: 3,
        totalChaptersCount: 6,
        subjects: [
          {
            id: 'sub-i1',
            name: 'Cardiopulmonary Pathology',
            code: 'PATH-303',
            chapters: [
              { id: 'chap-i1-1', title: 'Atherosclerosis & Ischemic Heart Disease Stages', readingTimeMinutes: 23 },
              { id: 'chap-i1-2', title: 'COPD vs. Bronchial Asthma Pathophysiology', readingTimeMinutes: 21 }
            ]
          },
          {
            id: 'sub-i2',
            name: 'Cardiopulmonary Pharmacology',
            code: 'PHARM-303',
            chapters: [
              { id: 'chap-i2-1', title: 'Antihypertensives: ACEi, ARBs, CCBs & Diuretics', readingTimeMinutes: 26 },
              { id: 'chap-i2-2', title: 'Bronchodilators & Inhaled Corticosteroid Regimens', readingTimeMinutes: 20 }
            ]
          },
          {
            id: 'sub-i3',
            name: 'Community Medicine & Public Health',
            code: 'COMM-303',
            chapters: [
              { id: 'chap-i3-1', title: 'Tuberculosis DOTS Strategy & National Control Program', readingTimeMinutes: 18 },
              { id: 'chap-i3-2', title: 'Air Pollution Indices & Occupational Pneumoconiosis', readingTimeMinutes: 17 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: '4th-year',
    yearNumber: 4,
    title: '4th Year MBBS',
    status: 'active',
    blocks: [
      {
        id: 'block-j',
        name: 'Block J (Neuroscience)',
        code: 'BLOCK-J',
        yearId: '4th-year',
        description: 'CNS Neoplasms, Meningitis, Cerebrovascular Accidents, Anticonvulsants, and Psychiatric Epidemiology.',
        subjectsCount: 3,
        totalChaptersCount: 6,
        subjects: [
          {
            id: 'sub-j1',
            name: 'Special Systemic Pathology (CNS)',
            code: 'PATH-401',
            chapters: [
              { id: 'chap-j1-1', title: 'CSF Profiles in Bacterial, Viral & Tubercular Meningitis', readingTimeMinutes: 22 },
              { id: 'chap-j1-2', title: 'Astrocytomas, Meningiomas & Schwannomas Histopathology', readingTimeMinutes: 24 }
            ]
          },
          {
            id: 'sub-j2',
            name: 'Clinical Neuropharmacology',
            code: 'PHARM-401',
            chapters: [
              { id: 'chap-j2-1', title: 'Antiepileptic Drugs: Mechanisms & Teratogenicity', readingTimeMinutes: 25 },
              { id: 'chap-j2-2', title: 'SSRIs, SNRIs & Antipsychotic Side-Effect Profiles', readingTimeMinutes: 21 }
            ]
          },
          {
            id: 'sub-j3',
            name: 'Community Medicine (Mental Health)',
            code: 'COMM-401',
            chapters: [
              { id: 'chap-j3-1', title: 'Substance Abuse Surveillance & Addiction Policy in KP', readingTimeMinutes: 15 },
              { id: 'chap-j3-2', title: 'Community Rehabilitation & Mental Health Act Guidelines', readingTimeMinutes: 16 }
            ]
          }
        ]
      },
      {
        id: 'block-k',
        name: 'Block K (GIT & Hepatobiliary)',
        code: 'BLOCK-K',
        yearId: '4th-year',
        description: 'Gastrointestinal & Hepatic Neoplasia, Cirrhosis complications, Anti-ulcer Pharmacotherapy, and Enteric Outbreaks.',
        subjectsCount: 3,
        totalChaptersCount: 6,
        subjects: [
          {
            id: 'sub-k1',
            name: 'Special Systemic Pathology (GIT)',
            code: 'PATH-402',
            chapters: [
              { id: 'chap-k1-1', title: 'Peptic Ulcer Disease & Gastric Adenocarcinoma Staging', readingTimeMinutes: 20 },
              { id: 'chap-k1-2', title: 'Hepatitis B & C Pathology, Cirrhosis & Portal Hypertension', readingTimeMinutes: 26 }
            ]
          },
          {
            id: 'sub-k2',
            name: 'Gastrointestinal Therapeutics',
            code: 'PHARM-402',
            chapters: [
              { id: 'chap-k2-1', title: 'Proton Pump Inhibitors & H. pylori Eradication Regimens', readingTimeMinutes: 18 },
              { id: 'chap-k2-2', title: 'Antiemetics & Inflammatory Bowel Disease Biologics', readingTimeMinutes: 19 }
            ]
          },
          {
            id: 'sub-k3',
            name: 'Community Medicine (Enteric Surveillance)',
            code: 'COMM-402',
            chapters: [
              { id: 'chap-k3-1', title: 'Investigation of Waterborne Cholera & Typhoid Epidemics', readingTimeMinutes: 19 },
              { id: 'chap-k3-2', title: 'Food Adulteration Laws & Nutritional Anemia Programs', readingTimeMinutes: 17 }
            ]
          }
        ]
      },
      {
        id: 'block-l',
        name: 'Block L (Renal, Endocrine & Reproduction)',
        code: 'BLOCK-L',
        yearId: '4th-year',
        description: 'Glomerular syndromes, Endocrine tumors, Diabetes micro/macrovascular pathology, and Maternal Health.',
        subjectsCount: 3,
        totalChaptersCount: 6,
        subjects: [
          {
            id: 'sub-l1',
            name: 'Special Pathology (Renal & Endocrine)',
            code: 'PATH-403',
            chapters: [
              { id: 'chap-l1-1', title: 'Nephrotic vs. Nephritic Syndromes: Biopsy Findings', readingTimeMinutes: 25 },
              { id: 'chap-l1-2', title: 'Thyroid Carcinomas & Diabetic Nephrosclerosis Pathology', readingTimeMinutes: 22 }
            ]
          },
          {
            id: 'sub-l2',
            name: 'Endocrine & Renal Therapeutics',
            code: 'PHARM-403',
            chapters: [
              { id: 'chap-l2-1', title: 'Insulin Formulations & Oral Hypoglycemic Agents (SGLT2i/GLP1)', readingTimeMinutes: 27 },
              { id: 'chap-l2-2', title: 'Loop & Thiazide Diuretics in Cardiorenal Failure', readingTimeMinutes: 20 }
            ]
          },
          {
            id: 'sub-l3',
            name: 'Community Medicine (MCH & Family Planning)',
            code: 'COMM-403',
            chapters: [
              { id: 'chap-l3-1', title: 'Maternal Mortality Ratio (MMR) & Antenatal Care Packages', readingTimeMinutes: 18 },
              { id: 'chap-l3-2', title: 'Contraceptive Prevalence Rate (CPR) & Population Dynamics', readingTimeMinutes: 16 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: '5th-year',
    yearNumber: 5,
    title: 'Final Year MBBS',
    status: 'coming soon',
    blocks: []
  }
];

// Helper functions for data access
export function getYearById(yearId: string): YearPackage | undefined {
  return YEARS.find((y) => y.id === yearId);
}

export function getBlockById(blockId: string): { block: Block; year: YearPackage } | undefined {
  for (const year of YEARS) {
    const foundBlock = year.blocks.find((b) => b.id === blockId);
    if (foundBlock) {
      return { block: foundBlock, year };
    }
  }
  return undefined;
}

export function getChapterById(chapterId: string): {
  chapter: Chapter;
  subject: Subject;
  block: Block;
  year: YearPackage;
} | undefined {
  for (const year of YEARS) {
    for (const block of year.blocks) {
      for (const subject of block.subjects) {
        const foundChap = subject.chapters.find((c) => c.id === chapterId);
        if (foundChap) {
          return { chapter: foundChap, subject, block, year };
        }
      }
    }
  }
  return undefined;
}

// -------------------------------------------------------------
// SAMPLE CHAPTER CONTENT FOR THE NOTES READER
// -------------------------------------------------------------
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
