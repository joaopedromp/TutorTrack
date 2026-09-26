interface GoogleCalendarState {configured:boolean;connected:boolean;calendarId:string;calendars:{id:string;name:string;primary:boolean}[]}
interface Window {tutortrack:{saveBackup(json:string,filename:string):Promise<boolean>;google:{
status():Promise<GoogleCalendarState>;importClient():Promise<GoogleCalendarState>;connect():Promise<GoogleCalendarState>;calendars():Promise<GoogleCalendarState>;select(id:string):Promise<GoogleCalendarState>;disconnect():Promise<GoogleCalendarState>;events(ids:string[]):Promise<{calendarId:string;events:import('./calendarImport').GoogleEvent[]}>;
}}}
