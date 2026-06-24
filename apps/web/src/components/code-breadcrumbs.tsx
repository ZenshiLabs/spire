import { Fragment } from "react";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function CodeBreadcrumbs({ path }: { path: string }) {
    const segments = path.split("/");
    return (
        <Breadcrumb className="min-w-0 overflow-x-auto">
            <BreadcrumbList className="flex-nowrap gap-1 px-3 py-1 text-xs sm:gap-1">
                {segments.map((segment, index) => (
                    <Fragment key={index}>
                        {index > 0 && <BreadcrumbSeparator className="[&>svg]:size-3" />}
                        <BreadcrumbItem>
                            {index === segments.length - 1 ? (
                                <BreadcrumbPage className="text-xs font-normal">{segment}</BreadcrumbPage>
                            ) : (
                                <span className="shrink-0 text-xs">{segment}</span>
                            )}
                        </BreadcrumbItem>
                    </Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
