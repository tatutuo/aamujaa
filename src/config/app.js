import { version } from '../../package.json';

/** Sovelluksen perustiedot yhdessä paikassa (Tietoja, palaute, otsikot). */
export const APP_NAME = 'puckoodi';
export const APP_VERSION = version;
export const APP_URL = 'https://d4nyyy.fi/hockey';
export const DEVELOPER = { name: 'd4nyyy', url: 'https://d4nyyy.fi' };

/**
 * Logo (public/icon.svg) versionumerolla: tiedostonimi ei muutu, joten ilman
 * sitä selain ja service worker näyttäisivät logon vaihduttua vanhaa kuvaa.
 */
export const LOGO_URL = `${import.meta.env.BASE_URL}icon.svg?v=${version}`;
