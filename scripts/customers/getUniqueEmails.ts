import { readFileSync, writeFileSync } from "fs";
import { resolvePath } from "../shared/helpers";

const headers = ['Email', 'Count'];

const filteredCustomers = JSON.parse(readFileSync(resolvePath(import.meta.url, "customers/filtered-customers.json"), "utf-8"));

const uniqueEmails = filteredCustomers.reduce((acc: Record<string, number>, customer: any) => {
  acc[`@${customer.defaultEmailAddress.emailAddress.split("@")[1]}`] = (acc[`@${customer.defaultEmailAddress.emailAddress.split("@")[1]}`] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

const csv = [headers, ...Object.entries(uniqueEmails).map(([email, count]) => [email, count])];
writeFileSync(resolvePath(import.meta.url, "customers/customer-emails-to-delete.csv"), csv.join("\n"));



