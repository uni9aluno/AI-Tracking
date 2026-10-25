import { Route, Switch, useLocation } from "wouter";
import AppShell from "./components/AppShell";
import ErrorBoundary from "./components/ErrorBoundary";
import About from "./pages/About";
import Benchmarks from "./pages/Benchmarks";
import Guide from "./pages/Guide";
import Home from "./pages/Home";
import Models from "./pages/Models";
import News from "./pages/News";
import NotFound from "./pages/NotFound";
import Papers from "./pages/Papers";
import Research from "./pages/Research";
import Saved from "./pages/Saved";
import Timeline from "./pages/Timeline";
import Trending from "./pages/Trending";

function Routes() {
  const [location] = useLocation();
  return (
    // One boundary per page, reset when the route changes.
    <ErrorBoundary key={location}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/noticias" component={News} />
        <Route path="/modelos" component={Models} />
        <Route path="/benchmarks" component={Benchmarks} />
        <Route path="/guia" component={Guide} />
        <Route path="/pesquisa" component={Research} />
        <Route path="/pesquisa/:provider" component={Research} />
        <Route path="/artigos" component={Papers} />
        <Route path="/em-alta" component={Trending} />
        <Route path="/linha-do-tempo" component={Timeline} />
        <Route path="/salvos" component={Saved} />
        <Route path="/como-funciona" component={About} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AppShell>
      <Routes />
    </AppShell>
  );
}
