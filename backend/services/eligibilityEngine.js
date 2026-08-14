/**
 * Smart Donor Eligibility Engine
 * Calculates donor eligibility based on medical guidelines:
 * - Age: 18 to 65
 * - Weight: Minimum 45.0 kg
 * - Donation Interval: 90 days between donations
 * - Health factors & questionnaire flag checks
 */
function calculateDonorEligibility(donor, healthQuestionnaire = {}) {
  const reasons = [];
  let status = 'ELIGIBLE';

  // 1. Age Check (18 - 65)
  const age = parseInt(donor.age) || 0;
  if (age < 18) {
    status = 'TEMPORARILY_INELIGIBLE';
    reasons.push('Minimum age requirement for voluntary blood donation is 18 years.');
  } else if (age > 65) {
    status = 'REQUIRES_MEDICAL_REVIEW';
    reasons.push('Donors over 65 years require medical officer approval prior to donation.');
  }

  // 2. Weight Check (≥ 45.0 kg)
  const weight = parseFloat(donor.weight) || 0;
  if (weight > 0 && weight < 45.0) {
    status = 'TEMPORARILY_INELIGIBLE';
    reasons.push('Minimum body weight requirement is 45 kg.');
  }

  // 3. Last Donation Date Check (90-day interval rule)
  let nextEligibleDate = null;
  if (donor.last_donation_date) {
    const lastDate = new Date(donor.last_donation_date);
    const minEligible = new Date(lastDate);
    minEligible.setDate(minEligible.getDate() + 90);
    nextEligibleDate = minEligible.toISOString().split('T')[0];

    const today = new Date();
    if (today < minEligible) {
      status = 'TEMPORARILY_INELIGIBLE';
      const daysRemaining = Math.ceil((minEligible - today) / (1000 * 60 * 60 * 24));
      reasons.push(`Mandatory 90-day interval requirement not met. ${daysRemaining} day(s) remaining until next eligible donation date.`);
    }
  }

  // 4. Questionnaire Flags
  if (healthQuestionnaire.recentIllness) {
    status = 'TEMPORARILY_INELIGIBLE';
    reasons.push('Recent fever, viral infection, or illness reported within last 14 days.');
  }
  if (healthQuestionnaire.surgeryLast6Months) {
    status = 'TEMPORARILY_INELIGIBLE';
    reasons.push('Major surgical procedure reported within the past 6 months.');
  }
  if (healthQuestionnaire.tattooLast6Months) {
    status = 'TEMPORARILY_INELIGIBLE';
    reasons.push('Tattoo or body piercing performed within the past 6 months.');
  }
  if (healthQuestionnaire.takingAntibiotics) {
    status = 'REQUIRES_MEDICAL_REVIEW';
    reasons.push('Active prescription antibiotic medication requires medical review.');
  }

  if (!nextEligibleDate) {
    nextEligibleDate = new Date().toISOString().split('T')[0];
  }

  return {
    status,
    isEligible: status === 'ELIGIBLE',
    next_eligible_date: nextEligibleDate,
    reasons,
    guideline_notice: 'Eligibility rules comply with National Blood Transfusion Council (NBTC) guidelines.'
  };
}

module.exports = {
  calculateDonorEligibility
};
