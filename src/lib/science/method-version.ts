export const METHOD_VERSION = {
  version: "1.2.0",
  publishedAt: "2026-09-16",
  notes: [
    "1.1.0 — Observer trust now weights evidence: computeSnapshot multiplies each observation's quality weight by trustMultiplier(observerTrust), shrinking noisy or disagreeing observers' influence towards neutral.",
    "1.2.0 — Sentinel-2 satellite readings enter computeSnapshot as an independent, coarse cross-check at a fixed evidence weight. The reflectance-to-hue-angle conversion uses CIE 1931 colour-matching weights at each band's centre wavelength and is NOT the published van der Woerd & Wernand Sentinel-2 hue-angle calibration (see satellite.hue-angle-calibration). When the citizen and satellite Forel-Ule readings diverge beyond the declared threshold, every contributing weight for that water body is halved: the posterior widens and data confidence cannot rise because of the diverging pass.",
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
    "van der Woerd, H.J. & Wernand, M.R. 2015, True Colour Classification of Natural Waters with Medium-Spectral Resolution Satellites: SeaWiFS, MODIS, MERIS and OLCI, Sensors 15(10):25663-25680, doi:10.3390/s151025663 — intended Sentinel-2 hue-angle calibration, not yet adopted",
    "van der Woerd, H.J. & Wernand, M.R. 2018, Hue-Angle Product for Low to Medium Spatial Resolution Optical Satellite Sensors, Remote Sensing 10(2):180, doi:10.3390/rs10020180 — Sentinel-2 delta-correction, not yet adopted",
    "Copernicus Sentinel data 2026, processed via Element 84 Earth Search STAC and AWS-hosted Sentinel-2 L2A Cloud-Optimised GeoTIFFs",
  ],
} as const;
