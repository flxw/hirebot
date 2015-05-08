(function($){
  $(function(){
    function refreshRepos() {
      $.get('/api/repositories').done(function(data) {
        $('.repo').remove()

        if (data.length === 0) {
          Materialize.toast('Your repositories are currently being fetched', 4000)
        }

        for (var i = data.length - 1; i >= 0; i--) {
          $('#repo-collection').append('<li class="repo collection-item">' +          data[i].name + '</li>')
        }
      })
    }

    $('#refresh-repos').click(refreshRepos)

    // initial requests
    refreshRepos()
  })
})(jQuery)