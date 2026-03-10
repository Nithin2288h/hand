/**
 * Checks if a volunteer is eligible for high-risk disaster response based on age.
 * @param {number} age - The age of the volunteer
 * @returns {object} - { eligible: boolean, message: string }
 */
function checkVolunteerEligibility(age) {
    if (age >= 20 && age <= 30) {
        return {
            eligible: true,
            status: 'Eligible',
            message: "Eligible for emergency disaster response"
        };
    } else {
        return {
            eligible: false,
            status: 'Ineligible',
            message: "Sorry, only volunteers between age 20 and 30 are allowed for high-risk disaster response tasks."
        };
    }
}

module.exports = { checkVolunteerEligibility };
