import { Token } from '../classes/token'

export function findTokenCollection(token: Token): string {

  let coll: string = ""

  if (token.mintAddress === ("9hCqMZy97mi5qooyKzEWSJB4dcdCBoY4FRykNrcNy3wqcgZ4ayH")) {

    if (token.name.includes("Ergoat")) {
      coll = "ergoats";
    } else if (token.name.startsWith("Gnomekin #")) {
      coll = "gnomekins";
    } else if (token.name.includes("Ergnome")) {
      coll = "ergnomes";
    } else if (token.name.includes("SigmaWorlds")) {
      coll = "sigmaworlds";
    }

  }

  return coll;
}