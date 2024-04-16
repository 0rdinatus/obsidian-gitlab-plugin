declare module '*.svg' {
	const content: string;
	export default content;
}

declare module "@gitbeaker/rest" {
    let Gitlab: any;
    export { Gitlab };
 }