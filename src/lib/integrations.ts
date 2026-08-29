export interface Integration {
  name: string;
  logo: string;
  href: string;
  blurb: string;
}

export const integrations: Integration[] = [
  {
    name: "Axiom",
    logo: "/img/axiom-logo.png",
    href: "https://axiom.trade",
    blurb: "One-click routing from any Limeryx alert straight into Axiom.",
  },
  {
    name: "Padre.gg",
    logo: "/img/padre-logo.png",
    href: "https://www.padre.gg",
    blurb: "Mirror tracked wallets into your Padre watchlists in real time.",
  },
  {
    name: "Photon",
    logo: "/img/photon-sol-logo.png",
    href: "https://photon-sol.tinyastro.io",
    blurb: "Deep-link every token feed straight into a Photon buy panel.",
  },
  {
    name: "BullX",
    logo: "/img/bullx-logo.png",
    href: "https://bullx.io",
    blurb: "Push live wallet signals into BullX with a single hotkey.",
  },
  {
    name: "GMGN",
    logo: "/img/gmgn-logo.png",
    href: "https://gmgn.ai",
    blurb: "Cross-check smart-money labels against GMGN wallet profiles.",
  },
  {
    name: "Jupiter",
    logo: "/img/jup-logo.png",
    href: "https://jup.ag",
    blurb: "Route the fill through Jupiter for best on-chain execution.",
  },
];
