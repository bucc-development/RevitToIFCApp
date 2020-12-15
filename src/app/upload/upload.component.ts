import { Component, OnInit } from '@angular/core';
import { FileUploader, UploadObjectResult } from '../file-upload/file-uploader.class';
import { ForgeService } from '../forge/forge.service';
import { UserService } from '../services/user.service';
import { ApiService } from '../services/api.service';

import { IForgeToken, IWorkItemResponse, IWorkItemStatus, ConversionObject } from '../services/api.model';
import { concatMap, flatMap, takeWhile, switchMap, tap, map, first } from 'rxjs/operators';
import { Observable, of, timer } from 'rxjs';
import { FileItem } from '../file-upload/file-item.class';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss']
})
export class UploadComponent {

  uploader: FileUploader;
  hasBaseDropZoneOver: boolean;
  hasAnotherDropZoneOver: boolean;

  constructor(private userService: UserService, private forgeService: ForgeService, private apiService: ApiService){
    const bucketKey = 'ifc-storage';
    const objectName = 'input-revit-model';
    const URL = forgeService.forgeURL + `/oss/v2/buckets/${bucketKey}/objects/${objectName}`;

    this.uploader = new FileUploader({
      url: URL,
      method: 'PUT',
      // headers: [{ name: 'Authorization', value: `Bearer ${userService.currentTokenValue?.access_token}` }],
      disableMultipart: true, // 'DisableMultipart' must be 'true' for formatDataFunction to be called.
      formatDataFunctionIsAsync: true,
      formatDataFunction: async (item) => {
        return new Promise( (resolve, reject) => {
          resolve({
            name: item._file.name,
            length: item._file.size,
            contentType: item._file.type,
            date: new Date()
          });
        });
      }
    }, forgeService, userService);

    this.hasBaseDropZoneOver = false;
    this.hasAnotherDropZoneOver = false;

    // this.uploader.response.subscribe( response: IUploadObject => {this.response = response ; console.log(response); } );

    const createWorkItemObs = (conversionObject: ConversionObject): Observable<ConversionObject> => {
      const currentFileItem: FileItem = conversionObject.uploadObjectResult.file;
      currentFileItem.isProcessing = true;
      currentFileItem.progress = null;
      currentFileItem.status = 'Converting ...';
      let outputName = currentFileItem.file.name.split('.').slice(0, -1).join('.');
      outputName = outputName + '.ifc';

      const revitVersion: string = currentFileItem.version;
      const activityId = 'RevitToIFC.RevitToIFCActivity' + revitVersion + '+' + revitVersion;

      return this.apiService.CreateWorkItem(conversionObject.uploadObjectResult.uploadObject.objectKey, outputName, activityId).pipe(
        map((workItemResponse: IWorkItemResponse ) => {
          conversionObject.uploadObjectResult.file.downloadUrl = workItemResponse.outputUrl;
          conversionObject.workItemResponse = workItemResponse;
          return conversionObject;
        })
      );
    };

    const getworkItemStatus = (conversionObject: ConversionObject): Observable<ConversionObject> => {
      return of (conversionObject).pipe(
        concatMap((cO: ConversionObject) => checkStatus(cO)),
        concatMap((cO: ConversionObject) => processConvertedObject(cO)),
      );
    };

    const checkStatus = (conversionObject: ConversionObject): Observable<ConversionObject> => {
      return timer(0, 2000).pipe(
        switchMap(() => this.apiService.GetWorkItemStatus(conversionObject.workItemResponse.workItemId)),
        first(workItemStatus => workItemStatus.status === 'success'),
        map(r => {
          conversionObject.worfItemStatus = r;
          return conversionObject;
        })
        );
    };

    const processConvertedObject = (conversionObject: ConversionObject): Observable<ConversionObject> => {
      return  of(conversionObject).pipe(
        map((cO: ConversionObject) => {
          cO.uploadObjectResult.file.isProcessing = false;
          cO.uploadObjectResult.file.status = 'Converted !';
          cO.uploadObjectResult.file.isConverted = true;
          return cO;
        })
      );
    };

    const conversionObservable = this.uploader.response.pipe(
      map((uor: UploadObjectResult ) =>  {
        const conversionObject: ConversionObject = {
          uploadObjectResult: uor,
          workItemResponse: null,
          worfItemStatus: null
      };
        return conversionObject;
      }),
      flatMap((conversionObject: ConversionObject) => createWorkItemObs(conversionObject)),
      flatMap( (conversionObject: ConversionObject) => getworkItemStatus(conversionObject))
    );

    conversionObservable.subscribe(r => console.log(r));

  }

  public fileOverBase(e: any): void {
    this.hasBaseDropZoneOver = e;
  }

  public fileOverAnother(e: any): void {
    this.hasAnotherDropZoneOver = e;
  }

}

