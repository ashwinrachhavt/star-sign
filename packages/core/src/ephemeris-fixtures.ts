/**
 * Golden-value fixtures for the ephemeris validation suite (ASH-239 / 1.4a).
 *
 * PROVENANCE
 * ----------
 * All reference longitudes are Observer Ecliptic-of-date Longitudes
 * ("ObsEcLon", quantity 31) retrieved from the JPL Horizons system
 * (https://ssd.jpl.nasa.gov/api/horizons.api) on 2026-10-24.
 *
 * Exact recipe per body (regenerate any value):
 *   format=text  COMMAND='<id>'  OBJ_DATA='NO'  MAKE_EPHEM='YES'
 *   EPHEM_TYPE='OBSERVER'  CENTER='500@399'  QUANTITIES='31'
 *   CSV_FORMAT='YES'  TLIST='<JD, JD, ...>'   (UTC, 9-decimal JDs)
 *
 * Body IDs: sun=10 moon=301 mercury=199 venus=299 mars=499
 *           jupiter=599 saturn=699 uranus=799 neptune=899 pluto=999
 *
 * ObsEcLon is the geocentric apparent position of the target center in
 * ecliptic-of-date coordinates, corrected for light-time, gravitational
 * deflection, and stellar aberration — the same frame the ephemeris
 * adapter computes (GeoVector(..., true) + Ecliptic, and EclipticGeoMoon
 * for the Moon). Horizons quotes 7 decimal places (~0.0004").
 *
 * Tolerances (ASH-239, owner-adjustable; product claims once shipped):
 *   Moon <= 0.1 deg, Sun/planets <= 0.01 deg, ascendant/MC <= 0.1 deg.
 *
 * Ascendant/MC are NOT covered by this fixture set: chart.ts currently
 * exposes the ascendant only as a sign (no degrees) and has no MC
 * surface at all — see ASH-239 comment for a discovered ascendant
 * quadrant bug. Those assertions land once the API exposes degrees.
 *
 * Chart UTC instants below were resolved from local wall time and
 * verified by hand (DST-correct): e.g. 1990-06-15 08:30 EDT = 12:30 UTC.
 */

export const INSTANTS = [
  "1990-06-15T12:30:00Z", // natal A
  "1985-11-30T09:15:00Z", // natal B
  "2000-02-29T22:10:00Z", // natal C (leap day)
  "1975-08-08T13:15:00Z", // natal D
  "2010-01-22T08:00:00Z", // natal E
  "2026-03-01T00:00:00Z", // transit 1
  "2026-10-24T00:00:00Z", // transit 2
] as const;

export const TOLERANCE: Record<string, number> = {
  moon: 0.1,
  sun: 0.01,
  mercury: 0.01, venus: 0.01, mars: 0.01, jupiter: 0.01,
  saturn: 0.01, uranus: 0.01, neptune: 0.01, pluto: 0.01,
};

/** ObsEcLon (deg, ecliptic of date) per body at each of the 7 instants. */
export const HORIZONS_LON: Record<string, number[]> = {
  sun: [84.1494404, 248.1099455, 340.6311436, 135.3796082, 302.1855111, 340.4059897, 210.5957892],
  moon: [345.6364781, 99.5483685, 280.5490537, 150.2272851, 19.1395641, 129.1169573, 2.3159678],
  mercury: [65.7264474, 244.6221396, 342.0761467, 142.9809125, 278.1580952, 351.9732711, 230.9730430],
  venus: [48.8020844, 236.0334240, 314.4799493, 161.6079362, 304.6837516, 353.2144267, 210.8460637],
  mars: [11.0562741, 201.0754768, 13.5399956, 56.0397930, 132.7562695, 328.7437488, 134.4943836],
  jupiter: [105.8939896, 312.2322146, 32.6573923, 24.6391263, 330.9524453, 105.2555442, 143.2794839],
  saturn: [294.0307082, 241.5811387, 42.4004179, 115.5692666, 184.5838828, 1.7240924, 9.8218735],
  uranus: [278.1643858, 257.5924021, 318.1461835, 208.8118191, 353.7943660, 57.7323186, 64.9513284],
  neptune: [283.7165428, 272.4124045, 305.3639878, 249.0676957, 325.2800201, 1.0440116, 2.2623737],
  pluto: [225.4010642, 215.9725156, 252.8415342, 187.2124459, 274.0517368, 304.5334730, 303.0832654],
};

/**
 * ObsEcLon at [instant - 1d, instant, instant + 1d] for the 7 planets.
 * Used to derive retrograde motion externally (finite difference), the
 * same method the adapter uses — but with Horizons numbers on both ends.
 */
export const HORIZONS_LON_PM1: Record<string, number[][]> = {
  mercury: [
    [64.0325372, 65.7264474, 67.4661560],
    [245.9714259, 244.6221396, 243.3443262],
    [343.0779262, 342.0761467, 341.0375919],
    [141.0292519, 142.9809125, 144.9082686],
    [277.4849523, 278.1580952, 278.9080481],
    [352.3262191, 351.9732711, 351.4738594],
    [230.8704651, 230.9730430, 230.9460969],
  ],
  venus: [
    [47.6265390, 48.8020844, 49.9785437],
    [234.7770196, 236.0334240, 237.2900143],
    [313.2444238, 314.4799493, 315.7155603],
    [161.6789537, 161.6079362, 161.4974740],
    [303.4269109, 304.6837516, 305.9404271],
    [351.9676113, 353.2144267, 354.4607978],
    [211.4570944, 210.8460637, 210.2334277],
  ],
  mars: [
    [10.3367937, 11.0562741, 11.7746247],
    [200.4541563, 201.0754768, 201.6965982],
    [12.7880674, 13.5399956, 14.2912693],
    [55.4022315, 56.0397930, 56.6745886],
    [133.1368857, 132.7562695, 132.3705737],
    [327.9557835, 328.7437488, 329.5316957],
    [133.9654586, 134.4943836, 135.0205124],
  ],
  jupiter: [
    [105.6776214, 105.8939896, 106.1109097],
    [312.0702194, 312.2322146, 312.3962346],
    [32.4683170, 32.6573923, 32.8480463],
    [24.6168516, 24.6391263, 24.6580977],
    [330.7265148, 330.9524453, 331.1792251],
    [105.2902312, 105.2555442, 105.2240764],
    [143.1394550, 143.2794839, 143.4174372],
  ],
  saturn: [
    [294.0888545, 294.0307082, 293.9715408],
    [241.4624802, 241.5811387, 241.6996622],
    [42.3190202, 42.4004179, 42.4831555],
    [115.4442552, 115.5692666, 115.6938416],
    [184.5987329, 184.5838828, 184.5672675],
    [1.6051258, 1.7240924, 1.8434983],
    [9.8928779, 9.8218735, 9.7516856],
  ],
  uranus: [
    [278.2031930, 278.1643858, 278.1253334],
    [257.5320109, 257.5924021, 257.6529205],
    [318.0912125, 318.1461835, 318.2008727],
    [208.7846051, 208.8118191, 208.8398201],
    [353.7544757, 353.7943660, 353.8348745],
    [57.7111136, 57.7323186, 57.7543207],
    [64.9834524, 64.9513284, 64.9186573],
  ],
  neptune: [
    [283.7414665, 283.7165428, 283.6914106],
    [272.3773682, 272.4124045, 272.4476562],
    [305.3314056, 305.3639878, 305.3962691],
    [249.0748514, 249.0676957, 249.0610426],
    [325.2445885, 325.2800201, 325.3156666],
    [1.0081587, 1.0440116, 1.0800281],
    [2.2861305, 2.2623737, 2.2389131],
  ],
  pluto: [
    [225.4214146, 225.4010642, 225.3810938],
    [215.9367049, 215.9725156, 216.0080249],
    [252.8328734, 252.8415342, 252.8496078],
    [187.1860110, 187.2124459, 187.2392700],
    [274.0187377, 274.0517368, 274.0844876],
    [304.5062680, 304.5334730, 304.5603808],
    [303.0797826, 303.0832654, 303.0872075],
  ],
};
