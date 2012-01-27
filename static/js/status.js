
// ### Status communication js
// Assumes prescence of
// - jQuery lib
// - jQuery mustache.js
// - socket.io lib

(function() {

  // templates to use with mustache
  template_segment = '<a href="{{url}}">Segment {{layout_order}}</a> on page {{page}} of type {{mode}} is complete';
  template_journal = '<div id="{{_id}}" class="masterj" data-numsegments="{{numsegments}}"><h3>{{title}}</h3><p>Owned by {{email}}</p><div class="ui-progress-bar ui-container"><div style="width: {{progress}}%;" class="ui-progress"><span class="ui-label"><b class="value" data-numdone="{{numdone}}">{{progress}}%</b></span></div></div><p>Transcription incomplete</p><ul class="segments">{{#segments}}<li id="{{_id}}"><a href="{{url}}">Segment {{layout_order}}</a> on page {{page}} is pending</li>{{/segments}}</ul></div>';
  template_status = 'Transcription complete<br/>You can view the pdfs at <a href="{{searchable}}">searchable</a> and <a href="{{transcribed}}">transcribed</a>.';

  // socket.io setup
  var socket;
  socket = io.connect('http://' + window.location.hostname);

  $(document).ready(function() {

    // socket listeners that need dom to be ready
    socket.on('updatesegment', function(seg) {

      console.log(seg);
      // update segment line
      $('#' + seg._id).html($.mustache(template_segment, seg));
      // update progress bar
      var numsegments = Number( $('#' + seg.journal_id).data('numsegments') )
        , numdone = Number( $('#' + seg.journal_id).find('.value').data('numdone') );
      numdone++;
      $('#' + seg.journal_id).find('.value').data('numdone', numdone);
      var percent = Math.ceil(numdone / numsegments * 100) + '%';
      $('#' + seg.journal_id).find('.value').text(percent);
      $('#' + seg.journal_id).find('.ui-progress').css('width', percent);

    });

    socket.on('newjournal', function(journal) {
      console.log(journal);
      // numsegments, numdone, percent
      journal.numsegments = journal.segments.length;
      journal.numdone = 0;
      journal.progress = 0;
      $('#journals_holder').append($.mustache(template_journal, journal));
    });

    socket.on('completejournal', function(journal) {
      console.log(journal);
      $('#' + journal._id).find('.status').html($.mustache(template_status, journal));
    });

  });

})(this);
