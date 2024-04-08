import { DependencyTree } from "../core/jobcall";
import { isCacheable, SLUG_VALUE } from "../core/slug";
import { indent, Lines } from "../support/indent";

export const renderDependenciesHTML = (dependencyTree: DependencyTree) => {
  return indent`<html>
<head>
<style>
details > :not(summary) {
    margin-left: 1em;
}
</style>
</head>
<body>
${renderDependencyNodeHTML(dependencyTree)}
</body>
</html>
`;
};

export const renderDependencyNodeHTML = (
  dependencyTree: DependencyTree
): Lines => {
  if (!isCacheable(dependencyTree.slug)) {
    return indent`<div>[uncacheable] ${dependencyTree.slug[SLUG_VALUE]}</div>`;
  }
  if (dependencyTree.dependencies.length === 0) {
    return indent`<div>[#${String(dependencyTree.jobIndex)}] [${
      dependencyTree.upToDate ? "upToDate" : "outOfDate"
    }] ${dependencyTree.slug[SLUG_VALUE]}</div>`;
  }
  return indent`<details>
    <summary>[#${String(dependencyTree.jobIndex)}] [${
    dependencyTree.upToDate ? "upToDate" : "outOfDate"
  }] ${dependencyTree.slug[SLUG_VALUE]}</summary>
    ${dependencyTree.dependencies.map(renderDependencyNodeHTML)}
</details>`;
};
