// Serves the static site and sends the www hosts to their bare domains.
const BARE_HOSTS = {
  "www.spacesonlabs.com": "spacesonlabs.com",
  "www.inboxsieve.com": "inboxsieve.com",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const bareHost = BARE_HOSTS[url.hostname];
    if (bareHost) {
      url.hostname = bareHost;
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
