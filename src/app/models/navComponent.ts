export class navComponent {
    title : string;
    path: string;
    component: string;
    crude?:{}
    componentModifiers?: object;
    authGroups?: string[];
    queryParams?: any;

    static classComponentTemplates = ["ClassMainPageComponent"]

    constructor(title: string, path: string, component: string, crude?:object, queryParams?: any, componentModifiers?:object)
    {
        this.component = component;
        this.title = title;
        this.path = path;
        if(crude == null)
        {
            this.crude = {};
        }
        else
        {
            this.crude = crude;
        }
        this.crude = crude;
        if(queryParams == null)
        {
            this.queryParams = [];
        }
        else
        {
            this.queryParams = queryParams;
        }
        this.componentModifiers = componentModifiers;
    }
}