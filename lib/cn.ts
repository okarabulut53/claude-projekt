import { twMerge } from "tailwind-merge";

export function cn(...classes: Array<string | undefined | false | null>) {
  return twMerge(classes.filter(Boolean).join(" "));
}
