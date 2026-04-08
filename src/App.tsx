import { WorkflowHeader } from "./components/WorkflowHeader";
import { WorkflowSteps } from "./components/WorkflowSteps";
import { ResourceLinks } from "./components/ResourceLinks";

function App() {
  return (
    <div className="page-container notranslate" translate="no">
      <WorkflowHeader />
      <WorkflowSteps />
      <ResourceLinks />
    </div>
  );
}

export default App;
