job "vessel" {
  datacenters = ["dc1"]
  type = "batch"

  task "vessel" {
    driver = "raw_exec"
    config {
      command = "/Users/michael/work/statemaps/vessel.sh"
      args = ["/Users/michael/work/statemaps/io-statemap.d"]
    }
    constraint {
      attribute = "${node.unique.id}"
      operator = "="
      value = "CLIENT_ID"
    }
  }
}