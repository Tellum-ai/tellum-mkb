import {
  FilterableBatchSpanProcessor,
  LangWatchTraceExporter,
} from "langwatch/observability";
import { setupObservability } from "langwatch/observability/node";

export function register() {
  setupObservability({
    serviceName: "tellum-mkb",
    // Disable the built-in LangWatch processor so we can install our own
    // filtered one (otherwise every span would be exported twice).
    langwatch: "disabled",
    spanProcessors: [
      new FilterableBatchSpanProcessor(new LangWatchTraceExporter(), [
        // Drop Next.js framework spans (render route, RSC GET, resolve page
        // components, executing api route, …). They all come from the "next"
        // instrumentation scope and add a lot of noise to the dashboard.
        {
          fieldName: "instrumentation_scope_name",
          matchValue: "next",
          matchOperation: "starts_with",
        },
      ]),
    ],
  });
}
