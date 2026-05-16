const Joi = require("joi");

exports.createMemberSchema = Joi.object({
  member_no: Joi.string().required(),
  full_name: Joi.string().required(),
  dob: Joi.date().iso().required(),
  policy_id: Joi.number().integer().positive().required(),
});

exports.createClaimSchema = Joi.object({
  member_id: Joi.number().integer().positive().required(),
  policy_id: Joi.number().integer().positive().required(),
  service_date: Joi.date().iso().required(),
  provider_name: Joi.string().required(),
  diagnosis_code: Joi.string().required(),
  line_items: Joi.array().min(1).required().items(
    Joi.object({
      service_code: Joi.string().required(),
      description: Joi.string().required(),
      billed_amount: Joi.number().positive().required(),
    })
  ),
});

exports.createDisputeSchema = Joi.object({
  reason: Joi.string().required().messages({
    "string.empty": "Reason is required to file a dispute.",
    "any.required": "Reason is required to file a dispute.",
  }),
});

exports.resolveDisputeSchema = Joi.object({
  resolution: Joi.string().valid("UPHELD", "OVERTURNED").required().messages({
    "any.only": "Resolution must be either UPHELD or OVERTURNED.",
    "any.required": "Resolution must be either UPHELD or OVERTURNED.",
  }),
  resolution_notes: Joi.string().required().messages({
    "string.empty": "Resolution notes are required.",
    "any.required": "Resolution notes are required.",
  }),
});
