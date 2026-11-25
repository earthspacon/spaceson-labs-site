// Sends the www hosts to their bare domains. It lives apart from the site Worker so that site pages can skip a Worker entirely.
const BARE_HOSTS = {
  "www.spacesonlabs.com": "spacesonlabs.com",
  "www.inboxsieve.com": "inboxsieve.com",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.protocol = "https:";
    url.hostname = BARE_HOSTS[url.hostname] ?? url.hostname.replace(/^www\./, "");
    return Response.redirect(url.toString(), 301);
  },
};
