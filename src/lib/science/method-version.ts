export const METHOD_VERSION = {
  version: "1.2.0",
  publishedAt: "2026-09-16",
  notes: [
    "1.2.0 — Observations flagged by plausibility checks no longer count towards assessments, trust or exports until a person reviews them. Resident-reported signs (clarity, sewage odour, algae, foam, dead fish, litter) move from OneAquaHealth analyte codes to the Rivulet code system. Flow and litter are now asked in the survey instead of defaulting.",
    "1.1.0 — Observer trust now weights evidence: computeSnapshot multiplies each observation's quality weight by trustMultiplier(observerTrust), shrinking noisy or disagreeing observers' influence towards neutral.",
  ],
  citations: [
    "Directive 2000/60/EC of the European Parliament and of the Council establishing a framework for Community action in the field of water policy (Water Framework Directive), Annex V",
    "Novoa, Wernand & van der Woerd 2013, The Forel-Ule scale revisited spectrally: preparation protocol, transmission measurements and chromaticity, J. Eur. Opt. Soc. Rapid Publ. 8, 13057 (hue angle class limits via CefasRepRes/FUME)",
    "Novoa et al. 2015, WACODI: a generic algorithm to derive the intrinsic color of natural waters from digital images, Limnology and Oceanography: Methods, doi:10.1002/lom3.10059",
    "IEC 61966-2-1:1999, Multimedia systems and equipment — Colour measurement and management — Default RGB colour space — sRGB",
    "Armitage, Moss, Wright & Furse 1983, The performance of a new biological water quality score system based on macroinvertebrates over a wide range of unpolluted running-water sites, Water Research 17:333-347",
    "Gelman et al. 2013, Bayesian Data Analysis, 3rd edition, CRC Press",
    "Gelman et al. 2013, Bayesian Data Analysis, 3rd edition, CRC Press, chapter 5 (hierarchical and shrinkage models — basis for shrinking observer trust towards neutral)",
    "HL7 Europe, OneAquaHealth FHIR Implementation Guide, github.com/hl7-eu/oah",
  ],
} as const;
