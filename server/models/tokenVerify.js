var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var TokenVerifySchema = new Schema({
    _userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true, ref: 'User'
    },
    token: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date, required: true,
      default: Date.now,
      expires: 43200
    }
});

module.exports = mongoose.model('TokenVerify', TokenVerifySchema);
