# Statemaps for Nomad

An experiment in bringing [Statemaps](https://github.com/joyent/statemap) to Nomad in an abstracted way.

Since Nomad is in the business of running software, why not run traces too?

This uses the following approach:

1. User goes to Client > Traces page
2. User clicks "Start Trace"
3. User chooses a Trace program
4. ClientID and Trace program are POSTed to the Nomad server (mocked here)
5. Nomad server generates a batch job constrained to the client requested that runs the trace requested.
6. UI counts up how long the trace has been running and presents a stop button.
7. User clicks "Stop Trace"
8. A POST request is made to the trace resource to stop it
9. Nomad server sends a SIGUSR1 to the task the generated trace task running on the client
10. Upon receiving the signal, the trace stops but the job is kept alive
11. Nomad responds with the trace object in the completed state
12. UI creates an iframe with the source `/trace/:id/svg`
13. SVG GET request is handled by Nomad
14. Nomad server fetches logs from the trace task
15. Nomad server posts the logs from the trace task along with configuration options to the Statemap Server
16. Statemap Server handles the POST request and generates a Statemap SVG from the request body
17. Nomad server receives the SVG from the Statemap server
18. Nomad server responds to the SVG GET request with the SVG
19. UI renders the SVG in an iframe where it can still have the Statemap JS controls and no style conflicts
20. User can explore the Statemap SVG