// The flow builder's "Persona" tab links here, but there is no persona editor
// for a journey: an agent's persona is edited on the agent itself. Without
// this file the tab ended on a 404. Send the owner to where it really lives.
import { redirect } from "next/navigation";

export default function PersonaRedirect() {
  redirect("/agents");
}
