
mongoose = require 'mongoose'
Schema = mongoose.Schema

exports.define = ->

  JournalSchema = new Schema
    title: String
    file_path: String
    transcribed: String
    searchable: String
    completed:
      type: Boolean
      default: false

  SegmentSchema = new Schema
    file_path: String
    url: String
    page: Number
    mode:
      type: String
      enum: [ 'text', 'math' ]
    transcription:
      type: String
      default: ''
    completed:
      type: Boolean
      default: false
    task_id: Number
    layout_order: Number
    journal_id: Schema.ObjectId

  mongoose.model 'Journal', JournalSchema
  mongoose.model 'Segment', SegmentSchema
