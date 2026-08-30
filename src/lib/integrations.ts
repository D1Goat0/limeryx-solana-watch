import axiom from "@/assets/axiom-logo.png";
import padre from "@/assets/padre-logo.png";
import photon from "@/assets/photon-sol-logo.png";
import bullx from "@/assets/bullx-logo.png";
import gmgn from "@/assets/gmgn-logo.png";
import jup from "@/assets/jup-logo.png";

export interface Integration {
  name: string;
  logo: string;
  href: string;
  blurb: string;
}

export const integrations: Integration[] = [
  {
    name: "Axiom",
    logo: axiom,
    href: "https://axiom.trade",
    blurb: "One-click routing from any Limeryx alert straight into Axiom.",
  },
  {
    name: "Padre.gg",
    logo: padre,
    href: "https://www.padre.gg",
    blurb: "Mirror tracked wallets into your Padre watchlists in real time.",
  },
  {
    name: "Photon",
    logo: photon,
    href: "https://photon-sol.tinyastro.io",
    blurb: "Deep-link every token feed straight into a Photon buy panel.",
  },
  {
    name: "BullX",
    logo: bullx,
    href: "https://bullx.io",
    blurb: "Push live wallet signals into BullX with a single hotkey.",
  },
  {
    name: "GMGN",
    logo: gmgn,
    href: "https://gmgn.ai",
    blurb: "Cross-check smart-money labels against GMGN wallet profiles.",
  },
  {
    name: "Jupiter",
    logo: jup,
    href: "https://jup.ag",
    blurb: "Route the fill through Jupiter for best on-chain execution.",
  },
];
