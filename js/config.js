// =============================================================================
//  SITE SETTINGS: edit this file to update contact details and assets.
//  Leave contact details blank unless they have been verified.
// =============================================================================
export const SITE = {
  email: 'fatimagracecgonzaga@gmail.com',
  linkedin: '',
  facebook: '',
  resume: '', // Set this to the path of your resume after adding the PDF.
  mailSubject: 'Hello from your teaching portfolio',

  // Optional Higgsfield assets. When these files exist they replace the built-in
  // real-time versions automatically (see README → "Dropping in Higgsfield assets").
  hero: {
    video: '',              // Optional 16:9 Seedance orbit (scrubbed by scroll)
    videoMobile: '',        // Optional 9:16 version for phones
    firstFrameCutout: '',   // Optional subject-only alpha cutout of frame 1
    // Scroll windows (0–1 of the hero) where each passage is shown. Match these to
    // the pauses in the video if its timing differs from the built-in orbit.
    passageWindows: [[0.17, 0.31], [0.39, 0.53], [0.61, 0.75], [0.83, 0.93]],
  },
};
