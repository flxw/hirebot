(function($){
  $(function(){
    function refreshData() {
      refreshRepos()
      refreshStatistics()
    }

    function refreshRepos() {
      $.get("/api/repositories").done(function(data) {
        $(".repo").remove()

        if (data.length === 0) {
          Materialize.toast("Your repositories are currently being fetched", 4000)
        }

        for (var i = data.length - 1; i >= 0; i--) {
          $("#repo-collection").append("<li class=\"repo collection-item\">" +  data[i].name + "</li>")
        }
      })
    }

    function refreshStatistics() {
      $.get("/api/statistics").done(function(data) {
        var tbody = $("#tbody")
        var template = "<tr><td>%language%</td><td>%firstcommitdate%</td><td>%productivity%</td><td>%avgcommitsize%</td><td>%linecount%</td></tr>"

        tbody.empty();

        for (var i = 0, j = data.length - 1; i <= j; i++) {
          var line = template

          line = template.replace(/%language%/, data[i].language)
                         .replace(/%firstcommitdate%/, (new Date(data[i].firstcommitdate)).toLocaleDateString())
                         .replace(/%productivity%/, data[i].productivity.toFixed(2))
                         .replace(/%avgcommitsize%/, data[i].averagecommitsize)
                         .replace(/%linecount%/, data[i].linecount)

          tbody.append(line)
        }
      })
    }

    $("#refresh-repos").click(refreshData)

    refreshData()
  })
})(jQuery)