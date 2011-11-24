(function() {
  var Schema, mongoose;

  mongoose = require('mongoose');

  Schema = mongoose.Schema;

  exports.define = function() {
    var JournalSchema, SegmentSchema;
    JournalSchema = new Schema({
      title: String,
      file_path: String
    });
    SegmentSchema = new Schema({
      file_path: String,
      page: Number,
      trans_type: {
        type: String,
        "enum": ['text', 'math']
      },
      transcription: {
        type: String,
        "default": ''
      },
      journal_id: Schema.ObjectId
    });
    mongoose.model('Journal', JournalSchema);
    return mongoose.model('Segment', SegmentSchema);
  };

}).call(this);